import warnings
import torch
import outlines
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig, logging
import uvicorn

logging.set_verbosity_error()
warnings.filterwarnings("ignore")

MODEL_ID = "psyc0dev/extraAI"
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
tokenizer.pad_token_id = tokenizer.eos_token_id
bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16, llm_int8_enable_fp32_cpu_offload=True)
_hf_model = AutoModelForCausalLM.from_pretrained(MODEL_ID, subfolder="bf16", quantization_config=bnb_config, device_map="auto")
_hf_model.config.tie_word_embeddings = False
_hf_model.lm_head.weight = _hf_model.model.embed_tokens.weight
model = outlines.from_transformers(_hf_model, tokenizer)

class CriterionScore(BaseModel):
    score: float = Field(ge=1.0, le=9.0)
    comment: str = Field(max_length=250)

class IELTSScore(BaseModel):
    task_response: CriterionScore
    coherence_and_cohesion: CriterionScore
    lexical_resource: CriterionScore
    grammatical_range_and_accuracy: CriterionScore

class EvaluateRequest(BaseModel):
    topic: str
    essay: str

PROMPT_TEMPLATE = """You are a highly experienced IELTS Writing Examiner with 15+ years of experience in high-stakes assessment. Your goal is to provide a rigorous, objective, and accurate evaluation of a Task 2 essay based on the official IELTS Public Band Descriptors.

How to evaluate effictively:
You should evaluate an essay four times, focusing on each criterion separately. This means reading the essay once for TR (Task Response), then again for CC (Coherence and Cohesion), and so on. 
Each time you read, remember down what stands out. This layered approach helps you identify strenghts and weaknesses that you might miss if you read the essay just once.

Evaluation Framework:
1. Task Response: Complete response, Clear & comprehensive ideas, Relevant & specific examples, Appropriate word count.
2. Coherence and Cohesion: Logical structure, Introduction & conclusion present, Supported main points, Accurate linking words, Variety in linking words.
3. Lexical Resource: Assess the range and precision of vocabulary (Varied vocabulary), use of collocations, and the impact of errors on communication (Accurate spelling & word formation).
4. Grammatical Range and Accuracy: Evaluate the variety of structures (Mix of complex & simple sentences), punctuation accuracy, and the frequency of error-free sentences (Clear and correct grammar).

Scoring Instructions:
- Be Fair but Strict.
- Each criterion MUST have a their own different score. Analyze each one independently.
- Do NOT give the same or similar scores across all criteria.
- For each dimension: 
  - Provide a score (1.0 - 9.0).
  - Provide comments: On the biggest weaknesses only.

Exam Topic:
{topic}

Candidate's Essay:
{essay}

Final Assessment Output:
Return the scores and comments for the four dimensions, followed by an Overall Band Score (the average of the four, rounded to the nearest half-band).
"""

def calibrate(s: float) -> float:
    return round(s * 2) / 2

def band_label(score: float) -> str:
    if score >= 8.0: return "Expert"
    if score >= 7.0: return "Good"
    if score >= 6.0: return "Competent"
    if score >= 5.0: return "Modest"
    if score >= 4.0: return "Limited"
    return "Extremely Limited"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/evaluate")
def evaluate(req: EvaluateRequest):
    if not req.topic.strip() or not req.essay.strip():
        return {"error": "Please provide both the topic and your essay."}

    word_count = len(req.essay.split())
    if word_count < 50:
        return {"error": "Essay is too short to evaluate."}

    prompt = PROMPT_TEMPLATE.format(topic=req.topic, essay=req.essay)
    try:
        raw = model(prompt, IELTSScore, max_new_tokens=1200, temperature=0.2, do_sample=True, repetition_penalty=1.2)
        result = IELTSScore.model_validate_json(raw) if isinstance(raw, str) else raw
    except Exception as e:
        return {"error": f"Scoring failed: {e}"}

    tr  = calibrate(result.task_response.score)
    cc  = calibrate(result.coherence_and_cohesion.score)
    lr  = calibrate(result.lexical_resource.score)
    gra = calibrate(result.grammatical_range_and_accuracy.score)
    overall = round((tr + cc + lr + gra) / 4 * 2) / 2

    penalty = 0.0
    if word_count < 250:
        penalty = 1.0 if word_count >= 200 else 1.5
        overall = max(1.0, round((overall - penalty) * 2) / 2)

    return {
        "word_count": word_count,
        "penalty": penalty,
        "overall": overall,
        "overall_label": band_label(overall),
        "criteria": {
            "task_response":                   {"score": tr,  "label": band_label(tr),  "comment": result.task_response.comment},
            "coherence_and_cohesion":          {"score": cc,  "label": band_label(cc),  "comment": result.coherence_and_cohesion.comment},
            "lexical_resource":                {"score": lr,  "label": band_label(lr),  "comment": result.lexical_resource.comment},
            "grammatical_range_and_accuracy":  {"score": gra, "label": band_label(gra), "comment": result.grammatical_range_and_accuracy.comment},
        }
    }

if __name__ == "__main__":
    import asyncio
    import nest_asyncio
    nest_asyncio.apply()
    asyncio.get_event_loop().run_until_complete(uvicorn.Server(uvicorn.Config(app, host="0.0.0.0", port=7860)).serve())