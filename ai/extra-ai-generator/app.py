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

MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
tokenizer.pad_token_id = tokenizer.eos_token_id
bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16, llm_int8_enable_fp32_cpu_offload=True)
_hf_model = AutoModelForCausalLM.from_pretrained(MODEL_ID, quantization_config=bnb_config, device_map="auto")
model = outlines.from_transformers(_hf_model, tokenizer)

class TopicResponse(BaseModel):
    topic: str = Field(description="A complete IELTS Writing Task 2 exam question.")

SYSTEM_PROMPT = (
    "You are an IELTS Writing Task 2 examiner. Generate one realistic exam-style Task 2 question. "
    "The question must be one of these types: "
    "Opinion: the question asks the reader to agree or disagree with a statement; "
    "Discussion: the question presents two opposing views and asks the reader to discuss both; "
    "Advantages/Disadvantages: the question asks about the advantages and disadvantages of something; "
    "Problem/Solution: the question asks about the causes of a problem and possible solutions; "
    "Two-Part Question: the question asks two separate questions about the same topic. "
    "Output only the question text. No title, no label, no explanation."
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
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "Generate an IELTS Writing Task 2 question."},
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    raw = model(prompt, TopicResponse, max_new_tokens=120, temperature=0.9, do_sample=True, repetition_penalty=1.1)
    result = TopicResponse.model_validate_json(raw) if isinstance(raw, str) else raw
    return {"topic": result.topic}

if __name__ == "__main__":
    import asyncio
    import nest_asyncio
    nest_asyncio.apply()
    asyncio.get_event_loop().run_until_complete(uvicorn.Server(uvicorn.Config(app, host="0.0.0.0", port=7860)).serve())
