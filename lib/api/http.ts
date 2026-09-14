import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "The request is invalid.", fieldErrors: collectFieldErrors(error) } },
      { status: 400 },
    );
  }
  console.error(error);
  return NextResponse.json({ error: { code: "internal_error", message: "An unexpected error occurred." } }, { status: 500 });
}

function collectFieldErrors(error:ZodError):Record<string,string[]>{
  const result:Record<string,string[]>={};
  for(const issue of error.issues){const path=issue.path.map(String).join(".")||"_form";(result[path]??=[]).push(issue.message)}
  return result;
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "The request body must be valid JSON.");
  }
  return schema.parse(json);
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}
