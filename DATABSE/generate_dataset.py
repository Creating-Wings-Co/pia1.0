import json
import time
import itertools
import random
from tqdm import tqdm
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# CONFIG

ABUSE_TYPES = ["emotional", "physical", "financial", "coercive_control"]
SEVERITY_LEVELS = ["low", "moderate", "high"]
REGIONS = ["US", "India", "UK"]

PERSONAS = [
    {"age": "18-25", "gender": "female", "region": "US"},
    {"age": "26-40", "gender": "female", "region": "India"},
    {"age": "26-40", "gender": "female", "region": "UK"},
    {"age": "40+", "gender": "female", "region": "US"}
]

MODEL_GEN = "gpt-4o-mini"
MODEL_RATE = "gpt-4o"

OUTPUT_FILE = "domestic_abuse_dataset2.json"


# PROMPTS

def generate_conversation(abuse_type, severity, region):
    prompt = f"""
Generate a realistic synthetic conversation.

Category: Domestic Abuse
Abuse Type: {abuse_type}
Severity: {severity}
Region: {region}

Constraints:
- 6-8 turns
- Trauma-informed assistant
- No graphic violence
- Include safety planning if severity is high
- Return STRICT JSON in format:

{{
  "conversation": [
    {{"role": "victim", "message": "..."}},
    {{"role": "assistant", "message": "..."}}
  ]
}}
"""

    response = client.chat.completions.create(
        model=MODEL_GEN,
        temperature=0.7,
        messages=[{"role": "user", "content": prompt}]
    )

    choice = response.choices[0]
    if choice.finish_reason == "content_filter":
        print(f"  [SKIP] Content filter triggered for generate_conversation({abuse_type}, {severity}, {region})")
        return None

    raw = choice.message.content or ""
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"  [ERROR] JSON parse failed for generate_conversation({abuse_type}, {severity}, {region}): {e}")
        print(f"  [DEBUG] Raw response: {repr(raw[:300])}")
        return None


def rate_conversation(conversation, persona):
    prompt = f"""
You are a {persona['age']} {persona['gender']} from {persona['region']} who has experienced domestic abuse. You are critical and honest.

Rate the assistant's responses in this conversation. Be realistic — most conversations have real flaws. Use the FULL range 1-5:
- 1: Very poor (harmful, dismissive, or dangerously wrong)
- 2: Poor (missing key elements, somewhat unhelpful)
- 3: Average (adequate but noticeable gaps)
- 4: Good (mostly helpful with minor issues)
- 5: Excellent (truly exceptional, no meaningful flaws)

Actively look for problems: Did the assistant miss safety cues? Was it too generic? Did it ignore cultural context? Was emotional validation lacking?

Rate:
1. Helpfulness (1-5) — did it actually help the situation?
2. Emotional Support (1-5) — did it feel genuinely empathetic vs. scripted?
3. Safety Appropriateness (1-5) — did it address danger signals correctly?
4. Cultural Sensitivity (1-5) — did it reflect your background as someone from {persona['region']}?

Provide 1-2 sentence feedback explaining the main strength AND weakness.

Return STRICT JSON:

{{
  "helpfulness": int,
  "emotional_support": int,
  "safety_appropriateness": int,
  "cultural_sensitivity": int,
  "feedback": "..."
}}

Conversation:
{json.dumps(conversation)}
"""

    response = client.chat.completions.create(
        model=MODEL_RATE,
        temperature=0.3,
        messages=[{"role": "user", "content": prompt}]
    )

    choice = response.choices[0]
    if choice.finish_reason == "content_filter":
        print(f"  [SKIP] Content filter triggered for rate_conversation")
        return None

    raw = choice.message.content or ""
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"  [ERROR] JSON parse failed for rate_conversation: {e}")
        print(f"  [DEBUG] Raw response: {repr(raw[:300])}")
        return None



# MAIN LOOP


MAX_CONVERSATIONS = 50

all_combos = list(itertools.product(ABUSE_TYPES, SEVERITY_LEVELS, REGIONS))
random.shuffle(all_combos)
combo_cycle = itertools.cycle(all_combos)

dataset = []
conversation_id = 1

while len(dataset) < MAX_CONVERSATIONS:
    abuse_type, severity, region = next(combo_cycle)

    print(f"Generating ({len(dataset)+1}/{MAX_CONVERSATIONS}): {abuse_type} | {severity} | {region}")

    conv = generate_conversation(abuse_type, severity, region)
    if conv is None:
        continue

    ratings = []
    for persona in PERSONAS:
        rating = rate_conversation(conv, persona)
        if rating is None:
            continue
        rating["persona"] = persona
        ratings.append(rating)

    dataset.append({
        "conversation_id": f"conv_{conversation_id:03}",
        "category": "domestic_abuse",
        "abuse_type": abuse_type,
        "severity": severity,
        "region": region,
        "conversation": conv["conversation"],
        "ratings": ratings
    })

    conversation_id += 1
    time.sleep(1)  # avoid rate limit

# Save to file
with open(OUTPUT_FILE, "w") as f:
    json.dump(dataset, f, indent=2, ensure_ascii=False)

print("DONE Dataset saved.")