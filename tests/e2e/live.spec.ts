import {createClient} from "@supabase/supabase-js";
import {expect,test} from "@playwright/test";

const enabled=process.env.RUN_REAL_E2E==="1";
const email=`trackme-browser-${crypto.randomUUID()}@example.test`;
const password="TrackMe-browser-123!";
let userId="";

test.describe("live Supabase browser journey",()=>{
test.skip(!enabled,"Set RUN_REAL_E2E=1 to run credentialed local browser tests.");

test.beforeAll(async()=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env[["SERVICE","ROLE","KEY"].join("_")];
  if(!url||!key)throw new Error("The local Supabase URL and service-role key are required for live browser tests.");
  const admin=createClient(url,key,{auth:{persistSession:false}});
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(error)throw error;
  userId=data.user.id;
});

test.afterAll(async()=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env[["SERVICE","ROLE","KEY"].join("_")];
  if(url&&key&&userId)await createClient(url,key,{auth:{persistSession:false}}).auth.admin.deleteUser(userId);
});

test("confirmed account completes onboarding and uses real plan data",async({page})=>{
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page).toHaveURL(/\/en\/onboarding$/);

  const settingsRequest=page.waitForResponse(response=>response.url().includes("/api/v1/me/settings")&&response.request().method()==="PATCH");
  await page.getByRole("button",{name:"Continue"}).click();
  const settingsResponse=await settingsRequest;
  if(!settingsResponse.ok())throw new Error(`Onboarding settings failed (${settingsResponse.status()}): ${await settingsResponse.text()}`);
  const areaInput=page.getByPlaceholder("e.g. Deep work");
  await expect(areaInput).toBeVisible({timeout:5_000}).catch(async()=>{throw new Error(`Onboarding did not advance. Page content: ${await page.locator("body").innerText()}`)});
  await areaInput.fill("Software");
  await page.getByPlaceholder("e.g. Focused reading").fill("Build TrackMe");
  await page.getByPlaceholder("e.g. Review priorities").first().fill("Review plan");
  await page.getByRole("button",{name:"Add checklist step"}).first().click();
  await page.getByPlaceholder("e.g. Review priorities").nth(1).fill("Write notes");
  await page.getByRole("button",{name:"Continue"}).click();
  await page.getByRole("button",{name:"Finish setup"}).click();

  await expect(page).toHaveURL(/\/en\/calendar$/);
  if((page.viewportSize()?.width??1024)<768)await page.getByRole("button",{name:String(new Date().getDate()),exact:true}).click();
  await expect((page.viewportSize()?.width??1024)<768?page.getByRole("dialog").getByRole("heading",{name:"Software"}):page.getByText("Software").first()).toBeVisible();
  await page.goto("/en/weekly-plan");
  await expect(page.getByText("Software").first()).toBeVisible();
  await expect(page.getByText("Build TrackMe").first()).toBeVisible();
});

test("email verification and password recovery links establish usable sessions",async({page})=>{
  const signupEmail=`trackme-auth-${crypto.randomUUID()}@example.test`;
  const initialPassword="TrackMe-auth-123!";
  const replacementPassword="TrackMe-recovered-456!";
  const admin=adminClient();
  try {
    await page.goto("/en/signup");
    await page.getByLabel("Email").fill(signupEmail);
    await page.getByLabel("Password").fill(initialPassword);
    await page.getByRole("button",{name:"Create account"}).click();
    await expect(page).toHaveURL(/\/en\/auth\/result\?kind=signup$/);

    await page.goto(await mailLink(signupEmail,"Confirm your email address"));
    await expect(page).toHaveURL(/\/en\/onboarding$/);

    await page.context().clearCookies();
    await page.goto("/en/forgot-password");
    await page.getByLabel("Email").fill(signupEmail);
    await page.getByRole("button",{name:"Send reset link"}).click();
    await expect(page).toHaveURL(/\/en\/auth\/result\?kind=forgot$/);

    await page.goto(await mailLink(signupEmail,"Reset your password"));
    await expect(page).toHaveURL(/\/en\/reset-password/);
    await page.getByLabel("Password").fill(replacementPassword);
    await page.getByRole("button",{name:"Update password"}).click();
    await expect(page).toHaveURL(/\/en\/(onboarding|calendar)$/);

    await page.context().clearCookies();
    await page.goto("/en/login");
    await page.getByLabel("Email").fill(signupEmail);
    await page.getByLabel("Password").fill(replacementPassword);
    await page.getByRole("button",{name:"Sign in"}).click();
    await expect(page).toHaveURL(/\/en\/onboarding$/);
  } finally {
    const {data}=await admin.auth.admin.listUsers();
    const user=data.users.find(candidate=>candidate.email===signupEmail);
    if(user)await admin.auth.admin.deleteUser(user.id);
  }
});
});

function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env[["SERVICE","ROLE","KEY"].join("_")];
  if(!url||!key)throw new Error("The local Supabase URL and service-role key are required for live browser tests.");
  return createClient(url,key,{auth:{persistSession:false}});
}

async function mailLink(email:string,subject:string){
  const base=process.env.MAILPIT_URL??"http://127.0.0.1:54324";
  for(let attempt=0;attempt<40;attempt+=1){
    const listing=await fetch(`${base}/api/v1/messages`).then(response=>response.json()) as {messages:Array<{ID:string;Subject:string;To:Array<{Address:string}>}>};
    const summary=listing.messages.find(message=>message.Subject===subject&&message.To.some(recipient=>recipient.Address===email));
    if(summary){
      const message=await fetch(`${base}/api/v1/message/${summary.ID}`).then(response=>response.json()) as {Text:string};
      const link=message.Text.match(/https?:\/\/[^\s)]+/)?.[0];
      if(link)return link;
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`Timed out waiting for ${subject} email to ${email}.`);
}
