import {afterEach,describe,expect,it,vi} from "vitest";
import {ApiClientError,apiFetch} from "@/components/api-client";

describe("apiFetch errors",()=>{
  afterEach(()=>vi.unstubAllGlobals());

  it("preserves the API status, code, message, and field errors",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{
      code:"validation_error",
      message:"The request is invalid.",
      fieldErrors:{timezone:["Must be a valid IANA timezone."]},
    }}),{status:400,headers:{"Content-Type":"application/json"}})));

    const error=await apiFetch("/api/v1/me/settings",{method:"PATCH"}).catch(value=>value);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({status:400,code:"validation_error",fieldErrors:{timezone:["Must be a valid IANA timezone."]}});
  });
});
