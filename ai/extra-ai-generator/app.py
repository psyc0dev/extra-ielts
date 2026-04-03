import warnings
import random
import torch
import outlines
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig, logging
import uvicorn

logging.set_verbosity_error()
warnings.filterwarnings("ignore")

MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
tokenizer.pad_token_id = tokenizer.eos_token_id

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True, 
    bnb_4bit_compute_dtype=torch.bfloat16, 
    llm_int8_enable_fp32_cpu_offload=True
)

_hf_model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID, 
    quantization_config=bnb_config, 
    device_map="auto"
)
model = outlines.from_transformers(_hf_model, tokenizer)

SENTENCE_PATTERN = r"^[A-Za-z0-9\s,.'\-\(\):;]+[\.?!]$"

class QuestionSchema(BaseModel):
    context: str = Field(
        pattern=SENTENCE_PATTERN,
        min_length=20,
        max_length=350,
        description="One or two sentences describing a real-world situation or trend."
    )
    question: str = Field(
        pattern=SENTENCE_PATTERN,
        min_length=10,
        max_length=200,
        description="The direct question or instruction to the candidate."
    )

QUESTION_TYPES = [
    ("Opinion", "To what extent do you agree or disagree?", "Some people think that governments should spend money on building new railway lines rather than repairing existing ones. To what extent do you agree or disagree?"),
    ("Discussion", "Discuss both views and give your own opinion.", "Some people believe that children should be taught to compete, while others think that cooperation is more important. Discuss both views and give your own opinion."),
    ("Advantages and Disadvantages", "What are the advantages and disadvantages of this?", "In many countries, mobile phones are used to pay for things. Does this development have more advantages or more disadvantages?"),
    ("Problem and Solution", "What are the causes of this problem and what measures could be taken to solve it?", "In many cities, the number of cars on the road is increasing rapidly. What are the causes of this problem and what measures could be taken to solve it?"),
    ("Two-Part Question", None, "Many people choose to travel abroad to learn a foreign language instead of studying in their home country. Why do people do this? Do you think it is a positive or negative development?"),
]

SYSTEM_PROMPT = (
    "You are an IELTS Writing Task 2 examiner. "
    "Generate a realistic Task 2 exam question. "
    "The 'context' should be a formal statement about a social trend. "
    "The 'question' must be the specific instruction. "
    "Do not use special characters like # or * or digits followed by brackets."
)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.post("/generate")
def generate():
    qtype, closing, example = random.choice(QUESTION_TYPES)
    
    if closing:
        user_msg = (
            f"Generate a Task 2 {qtype} question topic.\n"
            f"The 'question' field MUST end exactly with: {closing}\n"
            f"Do not repeat the example topic: {example}"
        )
    else:
        user_msg = (
            f"Generate a Task 2 Two-Part Question.\n"
            f"The 'question' field must contain two distinct questions.\n"
            f"Do not repeat the example topic: {example}"
        )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]
    
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    try:
        raw = model(
            prompt, 
            QuestionSchema, 
            max_new_tokens=400, 
            temperature=0.9, 
            do_sample=True, 
            repetition_penalty=1.1
        )
        
        result = QuestionSchema.model_validate(raw) if not isinstance(raw, str) else QuestionSchema.model_validate_json(raw)
        
        return {"topic": f"{result.context} {result.question}"}
    
    except Exception as e:
        return {"error": f"Generation failed: {str(e)}"}

if __name__ == "__main__":
    import asyncio
    import nest_asyncio
    nest_asyncio.apply()
    uvicorn.run(app, host="0.0.0.0", port=7860)