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
    comment: str = Field(max_length=600)

class IELTSScore(BaseModel):
    task_response: CriterionScore
    coherence_and_cohesion: CriterionScore
    lexical_resource: CriterionScore
    grammatical_range_and_accuracy: CriterionScore

class EvaluateRequest(BaseModel):
    topic: str
    essay: str

PROMPT_TEMPLATE = """You are an expert IELTS Writing examiner with 15+ years of experience in high-stakes assessment. Evaluate the Task 2 essay below using the four official IELTS band descriptors.

Read the essay four times — once per criterion — before scoring. This ensures each dimension is assessed independently and accurately.

For each criterion, provide:
1. A score from 1.0 to 9.0
2. A full, detailed comment (4-6 sentences) that covers:
   - What the candidate did well for this criterion
   - The most significant weakness, with a specific example quoted or paraphrased from the essay
   - How that weakness impacts the score
   - A concrete, actionable suggestion for improvement

Criteria:

1. Task Response (TR)
Does the essay fully address all parts of the prompt? Is the position clear, consistent, and well-developed? Are ideas supported with relevant, specific examples? Is the word count appropriate (250+ words)?

2. Coherence and Cohesion (CC)
Are ideas logically organised with clear progression? Is there an effective introduction and conclusion? Are cohesive devices (linking words, pronouns, referencing) used accurately and with variety? Is paragraphing appropriate?

3. Lexical Resource (LR)
Is vocabulary varied and precise? Are collocations and topic-specific terms used correctly? Are there errors in spelling or word formation that affect communication?

4. Grammatical Range and Accuracy (GRA)
Is there a mix of simple, compound, and complex sentence structures? Are grammatical errors rare and non-impeding? Is punctuation accurate?

Scoring Rules:
- Be strict and accurate. Do NOT inflate scores.
- Every criterion MUST receive a different score.
- Never give all four criteria the same or nearly identical scores.
- Base scores strictly on the essay content, not assumptions.

Exam Topic:
{topic}

Candidate's Essay:
{essay}
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
        raw = model(prompt, IELTSScore, max_new_tokens=1800, temperature=0.2, do_sample=True, repetition_penalty=1.2)
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