"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {cn} from "@/lib/utils";

export const Dialog=DialogPrimitive.Root;
export const DialogTrigger=DialogPrimitive.Trigger;
export const DialogClose=DialogPrimitive.Close;

export function DialogContent({className,children,...props}:React.ComponentProps<typeof DialogPrimitive.Content>){return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/30"/><DialogPrimitive.Content className={cn("fixed start-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-xl rtl:translate-x-1/2",className)} {...props}>{children}</DialogPrimitive.Content></DialogPrimitive.Portal>}
export function DialogHeader({className,...props}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn("space-y-1.5 text-start",className)} {...props}/>}
export function DialogFooter({className,...props}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn("mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",className)} {...props}/>}
export function DialogTitle({className,...props}:React.ComponentProps<typeof DialogPrimitive.Title>){return <DialogPrimitive.Title className={cn("text-lg font-semibold",className)} {...props}/>}
export function DialogDescription({className,...props}:React.ComponentProps<typeof DialogPrimitive.Description>){return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground",className)} {...props}/>}
