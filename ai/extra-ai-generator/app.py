import os
import random
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from groq import Groq
import uvicorn

client = Groq(api_key=os.environ["GROQ_API_KEY"])
MODEL = "llama-3.3-70b-versatile"

class QuestionSchema(BaseModel):
    context: str = Field(min_length=20, max_length=350)
    question: str = Field(min_length=10, max_length=200)

QUESTION_TYPES = [
    ("Opinion", "To what extent do you agree or disagree?", "Some people think that governments should spend money on building new railway lines rather than repairing existing ones. To what extent do you agree or disagree?"),
    ("Discussion", "Discuss both views and give your own opinion.", "Some people believe that children should be taught to compete, while others think that cooperation is more important. Discuss both views and give your own opinion."),
    ("Advantages and Disadvantages", "What are the advantages and disadvantages of this?", "In many countries, mobile phones are used to pay for things. Does this development have more advantages or more disadvantages?"),
    ("Problem and Solution", "What are the causes of this problem and what measures could be taken to solve it?", "In many cities, the number of cars on the road is increasing rapidly. What are the causes of this problem and what measures could be taken to solve it?"),
    ("Two-Part Question", None, "Many people choose to travel abroad to learn a foreign language instead of studying in their home country. Why do people do this? Do you think it is a positive or negative development?"),
]

SYSTEM_PROMPT = (
    "You are an IELTS Writing Task 2 examiner. "
    "Generate a realistic Task 2 exam question as a JSON object with two fields: "
    "'context' (a formal statement about a social trend) and "
    "'question' (the specific instruction to the candidate). "
    "Do not use special characters like # or *."
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
            f"Do not repeat the example topic: {example}\n"
            f"Respond with a JSON object only."
        )
    else:
        user_msg = (
            f"Generate a Task 2 Two-Part Question.\n"
            f"The 'question' field must contain two distinct questions.\n"
            f"Do not repeat the example topic: {example}\n"
            f"Respond with a JSON object only."
        )

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            response_format={"type": "json_object"},
            temperature=0.9,
        )
        result = QuestionSchema.model_validate_json(response.choices[0].message.content)
        return {"topic": f"{result.context} {result.question}"}
    except Exception as e:
        return {"error": f"Generation failed: {str(e)}"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
