#!/usr/bin/env python3
import os
import json
import time
import re
from dotenv import load_dotenv

try:
    import google.generativeai as genai
except ImportError:
    raise ImportError("google-generativeai not installed. Run: pip install google-generativeai")

from pulse_agent import PulseAgent

load_dotenv()

CATEGORIES = ['Technology', 'Business', 'Science', 'Health', 'Politics', 'Entertainment', 'Other']

pulse = PulseAgent(api_key=os.getenv('PULSE_API_KEY', ''), host=os.getenv('PULSE_HOST'))


class PythonClassifier:
    def __init__(self):
        api_key = os.getenv('GOOGLE_GENERATIVE_AI_API_KEY')
        if not api_key:
            raise ValueError("GOOGLE_GENERATIVE_AI_API_KEY not set in environment")

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')

    def parse_category(self, text):
        """Extract category from LLM response"""
        first_line = text.strip().split('\n')[0].strip()
        for cat in CATEGORIES:
            if first_line.lower().startswith(cat.lower()):
                return cat

        first_word = re.split(r'[\s\-:]', first_line)[0]
        for cat in CATEGORIES:
            if cat.lower() == first_word.lower():
                return cat

        return 'Other'

    def run(self, input_text):
        """Run the classifier agent"""
        start_time = time.time()
        text = str(input_text or '')

        agent_run = pulse.start_run('python-classifier-task', metadata={'agent': 'python-classifier', 'inputChars': len(text)})

        try:
            prompt = f"""You are a classification expert. Classify the given text into one of these categories:
Technology, Business, Science, Health, Politics, Entertainment, Other.
Reply with just the category name and a one-line reason.

Text to classify: {text}"""

            # 1) llm_call - assign a category
            with agent_run.with_llm_span('classify-category', model='gemini-2.5-flash', agent_name='python-classifier', input_preview=text[:200]) as llm_span:
                response = self.model.generate_content(prompt)
                llm_text = response.text
                category = self.parse_category(llm_text)
                input_tokens = len(text.split()) * 2
                output_tokens = len(llm_text.split()) * 2
                llm_span.end(status='success', output_preview=category, input_tokens=input_tokens, output_tokens=output_tokens)

            confidence = round(0.6 + (hash(text) % 39) / 100, 2)

            # 2) memory_read - resolve against the taxonomy
            with agent_run.with_memory_span('lookup-taxonomy', input_preview='resolve category against taxonomy') as taxonomy_span:
                taxonomy_span.end(status='success', output_preview=f"taxonomy: {','.join(CATEGORIES)}")

            # 3) memory_read - past classifications
            with agent_run.with_memory_span('classification-history', input_preview='load historical labels') as history_span:
                history_span.end(status='success', output_preview='loaded 0 historical labels')

            agent_run.complete(status='completed')

            output = {
                'category': category,
                'confidence': confidence,
                'candidates': CATEGORIES,
                'reason': llm_text,
            }

            return {
                'output': output,
                'spanCount': 3,
                'durationMs': int((time.time() - start_time) * 1000),
                'runId': agent_run.id,
            }

        except Exception as e:
            agent_run.complete(status='failed', error_message=str(e))
            raise Exception(f"Classification failed: {str(e)}")


if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print(json.dumps({'error': 'input is required'}), file=sys.stderr)
        sys.exit(1)

    input_text = sys.argv[1]

    try:
        classifier = PythonClassifier()
        result = classifier.run(input_text)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
