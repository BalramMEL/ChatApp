import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY environment variable." },
      { status: 500 },
    );
  }

  let payload: { prompt?: string; conversationName?: string | null };
  try {
    payload = (await request.json()) as { prompt?: string; conversationName?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const prompt = payload.prompt?.trim() ?? "";
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }
  if (prompt.length > 2_000) {
    return NextResponse.json(
      { error: "Prompt is too long. Keep it under 2000 characters." },
      { status: 400 },
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const contextLine = payload.conversationName
    ? `Current chat: ${payload.conversationName}`
    : "No specific chat selected.";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are a concise chat assistant. Give practical and short answers unless asked for detail.",
          },
          {
            role: "system",
            content: contextLine,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `AI provider error: ${errorText || response.statusText}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as OpenAiChatCompletionResponse;
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json({ error: "No reply returned from AI provider." }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "AI request timed out. Please try again." },
        { status: 504 },
      );
    }
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Unexpected AI request failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
