import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuestionInput, draftFromQuestion, preparationIssues, QUESTION_TEMPLATES, validateDraft } from "../src/lib/question-editor.ts";

test("new forms contain no invented fruit options or default correct answer", () => {
  const draft = draftFromQuestion();
  assert.equal(draft.answer, "");
  assert.deepEqual(draft.choices.map(choice => choice.text), ["", "", ""]);
});
test("an image containing the printed options only needs its option count and answer", () => {
  const draft = { ...draftFromQuestion(), imageUrl: "/api/v1/files/worksheet.webp", answer: "B" };
  assert.equal(validateDraft(draft), null);
  const question = buildQuestionInput(draft);
  assert.deepEqual(question.payload.options, ["", "", ""]);
  assert.equal(question.correctAnswer.answer, "B");
  assert.deepEqual(preparationIssues(question), []);
});
test("a listening draft can be saved before the author uploads audio or confirms the answer", () => {
  const draft = draftFromQuestion({ hskLevel:1, skill:"LISTENING", type:"MULTIPLE_CHOICE", difficulty:1, isGameQuestion:false,
    payload: { templateId:"listen-image-choice", imageUrl:"/api/v1/files/question.webp", options:["A","B","C"], reviewRequired:true }, correctAnswer:null });
  const question = buildQuestionInput(draft);
  assert.equal(question.correctAnswer, null);
  assert.equal(question.payload.audioStatus, "awaiting-upload");
  assert.deepEqual(preparationIssues(question), ["Chờ audio", "Chờ đáp án", "Chờ đối chiếu đề"]);
});
test("editing audio preserves the original scan and source metadata", () => {
  const original = { id:9, hskLevel:1, skill:"LISTENING", type:"MULTIPLE_CHOICE", difficulty:1, isGameQuestion:false,
    payload:{schemaVersion:1,templateId:"listen-text-choice",options:["A","B","C"],source:{pdfPage:24,item:4},imageUrl:"/api/v1/files/q.webp",reviewRequired:true},correctAnswer:null };
  const draft = {...draftFromQuestion(original),audioUrl:"/api/v1/files/lesson.mp3",start:"12.5",end:"18.5",answer:"C",reviewConfirmed:true};
  const question = buildQuestionInput(draft,original);
  assert.deepEqual(question.payload.source,original.payload.source);
  assert.deepEqual(question.payload.audioTimestamp,{start:12.5,end:18.5});
  assert.equal(question.payload.imageUrl,original.payload.imageUrl);
  assert.deepEqual(preparationIssues(question),[]);
});
test("invalid or out-of-duration audio ranges cannot be saved", () => {
  const base={...draftFromQuestion(),imageUrl:"/api/v1/files/q.webp",audioUrl:"/api/v1/files/audio.mp3"};
  for (const changes of [{start:"-1"},{start:"10",end:"5"},{start:"NaN"},{start:"0",end:"Infinity"},{start:"11",end:"15"}])
    assert.ok(validateDraft({...base,...changes},10));
  assert.ok(validateDraft({...base,audioUrl:"",start:"1"}));
});
test("an answer must belong to the available choices", () => {
  assert.ok(validateDraft({...draftFromQuestion(),imageUrl:"/api/v1/files/q.webp",answer:"D"}));
});
test("true/false and manual writing keep different answer contracts", () => {
  const tf=draftFromQuestion({hskLevel:1,skill:"READING",type:"TRUE_FALSE",difficulty:1,isGameQuestion:false,payload:{},correctAnswer:null});
  assert.deepEqual(buildQuestionInput({...tf,answer:"B"}).payload.options,["Đúng","Sai"]);
  const manual=draftFromQuestion({hskLevel:1,skill:"WRITING",type:"ESSAY",difficulty:1,isGameQuestion:false,payload:{},correctAnswer:null});
  const question=buildQuestionInput({...manual,answer:"Use the character structure shown in the original worksheet."});
  assert.equal(question.payload.manualGrading,true);
  assert.ok(question.correctAnswer.rubric);
  assert.equal(question.correctAnswer.answer,undefined);
});
test("all template identifiers are unique",()=>assert.equal(new Set(QUESTION_TEMPLATES.map(item=>item.id)).size,QUESTION_TEMPLATES.length));
