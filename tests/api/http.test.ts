import {describe,expect,it} from "vitest";
import {z} from "zod";
import {errorResponse} from "@/lib/api/http";

describe("API error responses",()=>{
  it("preserves complete Zod paths for nested form fields",async()=>{
    const schema=z.object({draft:z.object({items:z.array(z.object({name:z.string().min(1)}))})});
    const result=schema.safeParse({draft:{items:[{name:""}]}});
    if(result.success)throw new Error("Expected validation to fail");
    const response=errorResponse(result.error);
    expect(await response.json()).toMatchObject({error:{code:"validation_error",fieldErrors:{"draft.items.0.name":[expect.any(String)]}}});
  });
});
