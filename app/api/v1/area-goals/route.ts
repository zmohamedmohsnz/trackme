import {authenticate} from "@/lib/api/auth";
import {errorResponse,ok,parseJson} from "@/lib/api/http";
import {deleteAreaGoal,listAreaGoals,upsertAreaGoal} from "@/lib/api/repository";
import {areaGoalDeleteSchema,areaGoalUpsertSchema} from "@/lib/api/schemas";

export async function GET(request:Request){try{const {supabase,user}=await authenticate(request);return ok(await listAreaGoals(supabase,user.id))}catch(error){return errorResponse(error)}}
export async function PUT(request:Request){try{const input=await parseJson(request,areaGoalUpsertSchema);const {supabase,user}=await authenticate(request);return ok(await upsertAreaGoal(supabase,user.id,input))}catch(error){return errorResponse(error)}}
export async function DELETE(request:Request){try{const input=await parseJson(request,areaGoalDeleteSchema);const {supabase,user}=await authenticate(request);await deleteAreaGoal(supabase,user.id,input.id);return new Response(null,{status:204})}catch(error){return errorResponse(error)}}
