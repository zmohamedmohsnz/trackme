import {render,screen} from "@testing-library/react";
import {NextIntlClientProvider} from "next-intl";
import {describe,expect,it} from "vitest";
import en from "../../messages/en.json";
import {TaskCard} from "../../components/task-card";

describe("TaskCard",()=>{
  it("shows duration rollup and checklist progress",()=>{
    render(<NextIntlClientProvider locale="en" messages={en}><TaskCard date="2026-09-12" item={{
      item:{id:"1",kind:"area",name:"Deep work",position:0,checklist:[]},
      date:"2026-09-12",
      targetMinutes:120,
      directMinutes:30,
      contributedMinutes:45,
      actualMinutes:75,
      percent:62.5,
      complete:false,
      checklist:[{id:"c",itemId:"1",label:"Review",position:0,effectiveFrom:"2026-01-01",completed:true}],
    }}/></NextIntlClientProvider>);
    expect(screen.getByText("1h 15m / 2h")).toBeInTheDocument();
    expect(screen.getByText("Checklist: 1/1")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:/mark complete/i})).toBeInTheDocument();
  });
});
