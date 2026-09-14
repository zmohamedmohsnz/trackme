import {authenticate} from "@/lib/api/auth";
import {errorResponse,ok,parseJson} from "@/lib/api/http";
import {finalizeOnboarding,getOnboardingState,saveOnboardingDraft} from "@/lib/api/repository";
import {onboardingFinalizeSchema,onboardingSaveSchema} from "@/lib/api/schemas";

export async function GET(request:Request){
  try{const {supabase,user}=await authenticate(request);return ok(await getOnboardingState(supabase,user.id))}
  catch(error){return errorResponse(error)}
}

export async function PATCH(request:Request){
  try{const input=await parseJson(request,onboardingSaveSchema);const {supabase,user}=await authenticate(request);return ok(await saveOnboardingDraft(supabase,user.id,input))}
  catch(error){return errorResponse(error)}
}

export async function POST(request:Request){
  try{const input=await parseJson(request,onboardingFinalizeSchema);const {supabase,user}=await authenticate(request);return ok(await finalizeOnboarding(supabase,user.id,input))}
  catch(error){return errorResponse(error)}
}
