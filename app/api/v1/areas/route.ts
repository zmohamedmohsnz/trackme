import {authenticate} from "@/lib/api/auth";
import {errorResponse,ok,parseJson} from "@/lib/api/http";
import {createArea,deleteArea,listAreas,patchArea} from "@/lib/api/repository";
import {areaCreateSchema,areaDeleteSchema,areaPatchSchema} from "@/lib/api/schemas";

export async function GET(request:Request){try{const {supabase,user}=await authenticate(request);const url=new URL(request.url);return ok(await listAreas(supabase,user.id,url.searchParams.get("includeArchived")==="true"))}catch(error){return errorResponse(error)}}
export async function POST(request:Request){try{const input=await parseJson(request,areaCreateSchema);const {supabase,user}=await authenticate(request);return ok(await createArea(supabase,user.id,input),201)}catch(error){return errorResponse(error)}}
export async function PATCH(request:Request){try{const input=await parseJson(request,areaPatchSchema);const {supabase,user}=await authenticate(request);return ok(await patchArea(supabase,user.id,input))}catch(error){return errorResponse(error)}}
export async function DELETE(request:Request){try{const input=await parseJson(request,areaDeleteSchema);const {supabase,user}=await authenticate(request);await deleteArea(supabase,user.id,input.id);return new Response(null,{status:204})}catch(error){return errorResponse(error)}}
