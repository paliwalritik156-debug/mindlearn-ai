import { FUN_META, SIDEBAR_GROUPS } from "./lib.jsx"

// Hinglish names for tools, tag-lines and sidebar groups. Applied in place; English is restored when switched back.
const T = {
  chat:["PDF se baat karo","Tumhara document, ab bolta bhi hai."], notes:["Smart Notes","Sab kuch highlight karna strategy nahi hai."],
  flashcards:["Flashcards","Chhote-chhote yaad rakhne ke tukde."], quiz:["Quiz Generator","Ab dikhao kitna yaad hai."],
  youtube:["YouTube Notes","Kisi bhi lecture video ke notes banao."], essay:["Essay Writer","Pehla draft, ghostwriter nahi."],
  eli5:["Aasaan bhasha mein samjhao","Jab textbook insaan ki bhasha bhool jaye."], compare:["Concepts compare karo","Aamne-saamne, bina confusion."],
  image:["Visual Explainer","Ek picture = 1000 flashcards."], pomodoro:["Focus Timer","25 minute, koi bahana nahi."],
  vocabquiz:["Vocabulary Quiz","Bhaari words, aasaan."], map:["Concept Map","Syllabus ki ulajhan suljhao."],
  bookmarks:["Bookmarks","Tumhari apni highlight reel."], studyplan:["Study Planner","Calendar jo tumhari success chahta hai."],
  interview:["Mock Interview","Ghabrahat ki practice, chupke se."], theme:["Theme Picker","Kyunki beige ek jurm hai."],
  scores:["Leaderboard","Dosti wala competition, zyadatar khud se."], prompt:["Custom AI Prompt","Tutor ko batao kaise padhana hai."],
  typing:["Typing Trainer","Soch se tez type karo."], mnemonics:["Yaad rakhne ki tricks","Dimaag ko jo chahiye tha wo tricks."],
  difficulty:["Difficulty Rater","Seedhi baat, andaza nahi lagana padega."], srs:["Spaced Repetition","June mein yaad rahe, sirf kal nahi."],
  debate:["Khud se debate","Khud se bahas karo, kaam ki."], reading:["Reading Tracker","Taaki PDF padi-padi tumhe judge na kare."],
  multipdf:["Multi-PDF Chat","Ek baatcheet, saari readings."], codegen:["Code Generator","Pseudocode se asli code tak."],
  debugger:["Code Debugger","Tumhari rubber duck, jo jawab deti hai."], reviewer:["Code Reviewer","Wo imaandar teammate."],
  algorithm:["Algorithm Visualizer","Logic ko dekho, sirf padho mat."], knowledge:["3D Knowledge Map","Tumhara PDF, vichaaron ki galaxy."],
  pyq:["PYQ Practice","Purane paper, asli practice."], weakspots:["Weak-Spot Radar","Jaano kahan phisalte ho."], exam:["Exam Simulator","Asli paper, asli clock."],
  swipe:["Swipe Cards","Flashcards swipe karke review karo."], listen:["Listen Mode","Notes ko audio bana do."],
  sketch:["Sketchpad","Diagram aur formulas banao."], planner:["Study Planner","Exam tak din-ba-din plan."],
  mynotes:["Mere Notes","Tumhare apne notes, hamesha saved."], pdfsearch:["PDF mein dhoondo","Ctrl+F, par saare PDFs ke liye."],
  report:["Weekly Report","Tumhara hafta kaisa gaya."], library:["Document Library","Upload kiye saare PDFs, ek click door."],
  settings:["Settings","Apne hisaab se banao."], voice:["Voice Tutor","Bas bolo. Wo jawab dega."], codequiz:["Code Quiz","Isse pehle ki wo tumhe debug kare."],
}
const G = { Study:"Padhai", Practice:"Practice", Code:"Code", Tools:"Tools", "Smart Lab":"Smart Lab", Progress:"Progress", Workspace:"Workspace" }
const orig = { meta:{}, groups:SIDEBAR_GROUPS.map(g=>g.label) }
Object.entries(FUN_META).forEach(([k, v])=>{ orig.meta[k] = { title:v.title, tag:v.tag } })

export function applyHinglish(lang){
  const hi = lang === "hi"
  Object.entries(FUN_META).forEach(([k, v])=>{
    const o = orig.meta[k]; if(!o) return
    v.title = hi && T[k] ? T[k][0] : o.title
    v.tag = hi && T[k] ? T[k][1] : o.tag
  })
  SIDEBAR_GROUPS.forEach((g, i)=>{ g.label = hi ? (G[orig.groups[i]] || orig.groups[i]) : orig.groups[i] })
}
