#!/usr/bin/env python3
"""
Simultaneous Estonian-to-English translator that talks to an
OpenAI-compatible /v1/chat/completions endpoint.

## Example

python translate.py \
 --api-base http://localhost:8000/v1 \
 --model llama-3-8b-instruct \
 --input et.txt \
 --output en.txt
"""
import argparse
import sys
import time
import random
import re
from collections import deque
from typing import Deque, List, Iterator, Optional

import requests

# ---------------------------------------------------------------------------

# Helpers

# ---------------------------------------------------------------------------

def typewriter_print(text: str, min_delay: float = 0.02, max_delay: float = 0.05):
"""Print like an old terminal."""
for ch in text:
sys.stdout.write(ch)
sys.stdout.flush()
time.sleep(random.uniform(min_delay, max_delay))

def create*windows(text: str, window_size: int) -> Iterator[str]:
"""Yield `window_size`-word chunks from \_text*."""
words = text.split()
for i in range(0, len(words), window_size):
window = words[i : i + window_size]
if window:
yield " ".join(window)

# ---------------------------------------------------------------------------

# Translation

# ---------------------------------------------------------------------------

class ChatTranslator:
"""
Tiny wrapper around an OpenAI-compatible /chat/completions endpoint.
"""

    def __init__(
        self,
        api_base: str,
        model: str,
        api_key: Optional[str] = None,
        timeout: int = 60,
    ):
        self.api_base = api_base.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        if api_key:
            self.session.headers.update({"Authorization": f"Bearer {api_key}"})

    # -------------------------------------------------------------- #
    def create_chat_completion(
        self,
        messages: List[dict],
        max_tokens: int,
        temperature: float,
    ) -> str:
        """Call the endpoint once and return the assistant message."""
        url = f"{self.api_base}/chat/completions"
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }

        try:
            resp = self.session.post(url, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            # Let callers decide what to do on failure
            raise RuntimeError(f"API request failed: {exc}") from exc

def translate_text(
translator: ChatTranslator,
text: str,
system_prompt: str,
history: Deque[tuple[str, str]],
temperature: float,
max_tokens: int = 256,
) -> str:
"""
Build the message list from history, call the API, return the translation.
""" # Clean up stray spaces before punctuation (improves output quality)
text = re.sub(r"\s+([.,!?])", r"\1", text)

    messages = [{"role": "system", "content": system_prompt}]
    for usr, assistant in history:
        messages.append({"role": "user", "content": usr})
        messages.append({"role": "assistant", "content": assistant})
    messages.append({"role": "user", "content": text})

    try:
        return translator.create_chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    except Exception as e:
        print(f"[warn] Translation failed, echoing source text.  Reason: {e}", file=sys.stderr)
        return text  # Fallback: emit original text so stream keeps moving

def process_stream(
input_stream,
translator: ChatTranslator,
system_prompt: str,
window_size: int,
history_size: int,
history_clip_period: int,
temperature: float,
output_stream,
):
buffer: List[str] = []
history: Deque[tuple[str, str]] = deque(maxlen=history_size)
step = 0

    for line in input_stream:
        buffer.append(line.strip())
        if len(" ".join(buffer).split()) >= window_size:
            text = " ".join(buffer)
            for window in create_windows(text, window_size):
                # Periodically shrink history to avoid unbounded context growth
                if step and step % history_clip_period == 0:
                    while len(history) > history_size:
                        history.popleft()

                translation = translate_text(
                    translator,
                    window,
                    system_prompt,
                    history,
                    temperature,
                )
                print(translation, file=output_stream, flush=True, end=" ")

                history.append((window, translation))
                step += 1
            buffer = []

    # Flush any leftover words
    if buffer:
        text = " ".join(buffer)
        for window in create_windows(text, window_size):
            translation = translate_text(
                translator,
                window,
                system_prompt,
                history,
                temperature,
            )
            print(translation, file=output_stream, flush=True, end=" ")
            history.append((window, translation))

# ---------------------------------------------------------------------------

# CLI

# ---------------------------------------------------------------------------

def setup_argument_parser() -> argparse.ArgumentParser:
p = argparse.ArgumentParser(
description="Translate text using an OpenAI-compatible chat completion API"
)

    # API & model ----------------------------------------------------------------
    p.add_argument(
        "--api-base",
        required=True,
        help="Base URL of the OpenAI-compatible API, e.g. http://localhost:8000/v1",
    )
    p.add_argument(
        "--model",
        required=True,
        help="Model ID to pass to the /chat/completions endpoint",
    )
    p.add_argument(
        "--api-key",
        default=None,
        help="Optional bearer token for authenticated endpoints",
    )

    # I/O ------------------------------------------------------------------------
    p.add_argument(
        "--input",
        type=argparse.FileType("r"),
        default=sys.stdin,
        help="Input file (default: stdin)",
    )
    p.add_argument(
        "--output",
        type=argparse.FileType("w"),
        default=sys.stdout,
        help="Output file (default: stdout)",
    )

    # Behaviour ------------------------------------------------------------------
    p.add_argument(
        "--system-prompt",
        default=(
            "You are a professional Estonian-to-English simultaneous interpreter. "
            "Translate the following conversations into English."
        ),
        help="System prompt to steer the model",
    )
    p.add_argument(
        "--window-size",
        type=int,
        default=4,
        help="Words per translation window (default: 3)",
    )
    p.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="Sampling temperature (default: 0.0)",
    )
    p.add_argument(
        "--history-size",
        type=int,
        default=10,
        help="Number of previous translations to keep in chat history (default: 10)",
    )
    p.add_argument(
        "--history-clip-period",
        type=int,
        default=10,
        help="How often to clip history (default: 10)",
    )

    return p

def main() -> None:
args = setup_argument_parser().parse_args()

    # Create translator ----------------------------------------------------------
    translator = ChatTranslator(
        api_base=args.api_base,
        model=args.model,
        api_key=args.api_key,
    )

    # Process input --------------------------------------------------------------
    try:
        process_stream(
            input_stream=args.input,
            translator=translator,
            system_prompt=args.system_prompt,
            window_size=args.window_size,
            history_size=args.history_size,
            history_clip_period=args.history_clip_period,
            temperature=args.temperature,
            output_stream=args.output,
        )
    except KeyboardInterrupt:
        print("\n[info] Translation interrupted by user", file=sys.stderr)
    finally:
        if args.input is not sys.stdin:
            args.input.close()
        if args.output is not sys.stdout:
            args.output.close()

if **name** == "**main**":
main()
