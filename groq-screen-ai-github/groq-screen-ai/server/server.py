"""
Optional Python backend server using Flask + Groq SDK.
Use this if you prefer to keep your API key server-side instead of in the extension.

Install: pip install flask flask-cors groq
Run:     python server.py
"""

from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from groq import Groq
import json
import os

app = Flask(__name__)
CORS(app)  # Allow extension to call this server

# Set your Groq API key here OR use environment variable GROQ_API_KEY
client = Groq(api_key=os.environ.get("GROQ_API_KEY", "YOUR_GROQ_API_KEY_HERE"))

MODEL = "openai/gpt-oss-120b"


@app.route("/ask", methods=["POST"])
def ask():
    """Non-streaming endpoint"""
    data = request.json
    page_content = data.get("content", "")
    question = data.get("question", "")

    if not question:
        return jsonify({"error": "No question provided"}), 400

    messages = [
        {
            "role": "system",
            "content": "You are a helpful AI assistant. The user has captured content from their browser. Be concise and accurate."
        },
        {
            "role": "user",
            "content": f"Browser content:\n\n{page_content}\n\n---\n\nQuestion: {question}"
        }
    ]

    completion = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=1,
        max_completion_tokens=8192,
        top_p=1,
    )

    return jsonify({
        "answer": completion.choices[0].message.content,
        "model": completion.model,
        "usage": {
            "prompt_tokens": completion.usage.prompt_tokens,
            "completion_tokens": completion.usage.completion_tokens,
        }
    })


@app.route("/ask/stream", methods=["POST"])
def ask_stream():
    """Streaming endpoint - returns Server-Sent Events"""
    data = request.json
    page_content = data.get("content", "")
    question = data.get("question", "")

    if not question:
        return jsonify({"error": "No question provided"}), 400

    messages = [
        {
            "role": "system",
            "content": "You are a helpful AI assistant. The user has captured content from their browser. Be concise and accurate."
        },
        {
            "role": "user",
            "content": f"Browser content:\n\n{page_content}\n\n---\n\nQuestion: {question}"
        }
    ]

    def generate():
        completion = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=1,
            max_completion_tokens=8192,
            top_p=1,
            reasoning_effort="medium",
            stream=True,
        )

        for chunk in completion:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                # Server-Sent Events format
                yield f"data: {json.dumps({'content': delta})}\n\n"

        yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL})


if __name__ == "__main__":
    print(f"🚀 Groq AI Server running on http://localhost:5000")
    print(f"   Model: {MODEL}")
    app.run(host="0.0.0.0", port=5000, debug=False)
