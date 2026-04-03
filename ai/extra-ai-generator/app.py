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
bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16, llm_int8_enable_fp32_cpu_offload=True)
_hf_model = AutoModelForCausalLM.from_pretrained(MODEL_ID, quantization_config=bnb_config, device_map="auto")
model = outlines.from_transformers(_hf_model, tokenizer)

class TopicResponse(BaseModel):
    topic: str = Field(description="A complete IELTS Writing Task 2 exam question.")

QUESTION_TYPES = [
    "Opinion: a statement about a current issue, ending with 'To what extent do you agree or disagree?'",
    "Discussion: two contrasting views on a topic, ending with 'Discuss both views and give your own opinion.'",
    "Advantages and Disadvantages: a trend or development, ending with 'What are the advantages and disadvantages of this?'",
    "Problem and Solution: a social or global problem, ending with 'What are the causes of this problem and what measures could be taken to solve it?'",
    "Two-Part Question: a situation or trend followed by two distinct questions about it.",
]

SYSTEM_PROMPT = (
    "You are an IELTS Writing Task 2 examiner. Write one complete, realistic exam-style Task 2 question. "
    "Write only the question text. No labels, no headings, no explanations."
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/generate")
def generate():
    question_type = random.choice(QUESTION_TYPES)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Write a Task 2 question of this type: {question_type}"},
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    raw = model(prompt, TopicResponse, max_new_tokens=150, temperature=1.1, do_sample=True, repetition_penalty=1.3)
    result = TopicResponse.model_validate_json(raw) if isinstance(raw, str) else raw
    return {"topic": result.topic}

if __name__ == "__main__":
    import asyncio
    import nest_asyncio
    nest_asyncio.apply()
    asyncio.get_event_loop().run_until_complete(uvicorn.Server(uvicorn.Config(app, host="0.0.0.0", port=7860)).serve())
