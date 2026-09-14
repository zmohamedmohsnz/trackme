import type {ApiFieldErrors} from "./api-client";

export function hasFieldError(errors:ApiFieldErrors,...paths:string[]){
  return paths.some(path=>Object.keys(errors).some(key=>key===path||key.startsWith(`${path}.`)));
}

export function ValidationFeedback({id,message}:{id:string;message?:string}){
  if(!message)return null;
  return <p id={id} role="alert" className="mt-1 text-start text-xs text-destructive">{message}</p>;
}
