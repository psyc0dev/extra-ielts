import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from groq import Groq
import uvicorn

client = Groq(api_key=os.environ["GROQ_API_KEY"])
MODEL = "llama-3.3-70b-versatile"

class TRScore(BaseModel):
    relevance_to_prompt: float = Field(ge=1.0, le=9.0)
    clarity_of_position: float = Field(ge=1.0, le=9.0)
    depth_of_ideas: float = Field(ge=1.0, le=9.0)
    appropriateness_of_format: float = Field(ge=1.0, le=9.0)
    relevant_and_specific_examples: float = Field(ge=1.0, le=9.0)
    comment: str

class CCScore(BaseModel):
    logical_organization: float = Field(ge=1.0, le=9.0)
    effective_introduction_and_conclusion: float = Field(ge=1.0, le=9.0)
    supported_main_points: float = Field(ge=1.0, le=9.0)
    cohesive_devices_usage: float = Field(ge=1.0, le=9.0)
    paragraphing: float = Field(ge=1.0, le=9.0)
    comment: str

class GRAScore(BaseModel):
    sentence_structure_variety: float = Field(ge=1.0, le=9.0)
    grammar_accuracy: float = Field(ge=1.0, le=9.0)
    punctuation_usage: float = Field(ge=1.0, le=9.0)
    comment: str

class LRScore(BaseModel):
    vocabulary_range: float = Field(ge=1.0, le=9.0)
    lexical_accuracy: float = Field(ge=1.0, le=9.0)
    spelling_and_word_formation: float = Field(ge=1.0, le=9.0)
    comment: str

class IELTSScore(BaseModel):
    task_response: TRScore
    coherence_and_cohesion: CCScore
    grammatical_range_and_accuracy: GRAScore
    lexical_resource: LRScore

class EvaluateRequest(BaseModel):
    topic: str
    essay: str

PROMPT_TEMPLATE = """Task: ielts-writing-task-2.
The task prompt:
"{topic}"

The candidate's essay:
"{essay}"

You are an expert IELTS Writing Task 2 examiner with 15+ years of experience. Evaluate the essay above using the four official IELTS band descriptors. Score each sub-criterion independently on a scale of 1.0 to 9.0, then provide a detailed examiner comment per criterion.

Scoring rules:
- Be strict and realistic. Do NOT inflate scores. A strong but imperfect essay is typically 6.5–7.5.
- Sub-scores within a criterion may differ from each other.
- Base all scores strictly on the essay content — no assumptions.

Criteria and sub-scores to evaluate:

1. task_response
   - relevance_to_prompt: Does the essay fully address all parts of the prompt?
   - clarity_of_position: Is the candidate's position clear and consistent throughout?
   - depth_of_ideas: Are ideas well-developed with sufficient explanation?
   - appropriateness_of_format: Is the essay format appropriate for Task 2 (intro, body, conclusion)?
   - relevant_and_specific_examples: Are examples relevant, specific, and well-integrated?
   - comment: 3–5 sentence examiner comment covering strengths, the most significant weakness with a specific quote or paraphrase from the essay, and a concrete improvement suggestion.

2. coherence_and_cohesion
   - logical_organization: Are ideas logically sequenced with clear progression?
   - effective_introduction_and_conclusion: Are the introduction and conclusion effective and complete?
   - supported_main_points: Is each main point supported with explanation or evidence?
   - cohesive_devices_usage: Are linking words and referencing used accurately and with variety?
   - paragraphing: Is paragraphing logical and consistent?
   - comment: 3–5 sentence examiner comment (same format as above).

3. grammatical_range_and_accuracy
   - sentence_structure_variety: Is there a mix of simple, compound, and complex structures?
   - grammar_accuracy: Are grammatical errors rare and non-impeding?
   - punctuation_usage: Is punctuation accurate throughout?
   - comment: 3–5 sentence examiner comment (same format as above).

4. lexical_resource
   - vocabulary_range: Is vocabulary varied and topic-appropriate?
   - lexical_accuracy: Are words and collocations used correctly?
   - spelling_and_word_formation: Are spelling and word formation accurate?
   - comment: 3–5 sentence examiner comment (same format as above).

Respond with a JSON object only."""

def avg(*scores: float) -> float:
    return sum(scores) / len(scores)

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
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        result = IELTSScore.model_validate_json(response.choices[0].message.content)
    except Exception as e:
        return {"error": f"Scoring failed: {e}"}

    tr  = result.task_response
    cc  = result.coherence_and_cohesion
    gra = result.grammatical_range_and_accuracy
    lr  = result.lexical_resource

    tr_score  = calibrate(avg(tr.relevance_to_prompt, tr.clarity_of_position, tr.depth_of_ideas, tr.appropriateness_of_format, tr.relevant_and_specific_examples))
    cc_score  = calibrate(avg(cc.logical_organization, cc.effective_introduction_and_conclusion, cc.supported_main_points, cc.cohesive_devices_usage, cc.paragraphing))
    gra_score = calibrate(avg(gra.sentence_structure_variety, gra.grammar_accuracy, gra.punctuation_usage))
    lr_score  = calibrate(avg(lr.vocabulary_range, lr.lexical_accuracy, lr.spelling_and_word_formation))
    overall   = round((tr_score + cc_score + gra_score + lr_score) / 4 * 2) / 2

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
            "task_response": {
                "score": tr_score, "label": band_label(tr_score), "comment": tr.comment,
                "sub_scores": {
                    "relevance_to_prompt": tr.relevance_to_prompt,
                    "clarity_of_position": tr.clarity_of_position,
                    "depth_of_ideas": tr.depth_of_ideas,
                    "appropriateness_of_format": tr.appropriateness_of_format,
                    "relevant_and_specific_examples": tr.relevant_and_specific_examples,
                }
            },
            "coherence_and_cohesion": {
                "score": cc_score, "label": band_label(cc_score), "comment": cc.comment,
                "sub_scores": {
                    "logical_organization": cc.logical_organization,
                    "effective_introduction_and_conclusion": cc.effective_introduction_and_conclusion,
                    "supported_main_points": cc.supported_main_points,
                    "cohesive_devices_usage": cc.cohesive_devices_usage,
                    "paragraphing": cc.paragraphing,
                }
            },
            "grammatical_range_and_accuracy": {
                "score": gra_score, "label": band_label(gra_score), "comment": gra.comment,
                "sub_scores": {
                    "sentence_structure_variety": gra.sentence_structure_variety,
                    "grammar_accuracy": gra.grammar_accuracy,
                    "punctuation_usage": gra.punctuation_usage,
                }
            },
            "lexical_resource": {
                "score": lr_score, "label": band_label(lr_score), "comment": lr.comment,
                "sub_scores": {
                    "vocabulary_range": lr.vocabulary_range,
                    "lexical_accuracy": lr.lexical_accuracy,
                    "spelling_and_word_formation": lr.spelling_and_word_formation,
                }
            },
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
