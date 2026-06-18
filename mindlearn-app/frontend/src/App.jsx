import { useState, useRef, useEffect } from "react"
import axios from "axios"

const API = "http://localhost:8000"

// Fonts
const fontLink = document.createElement("link")
fontLink.href = "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@300;400&display=swap"
fontLink.rel = "stylesheet"
document.head.appendChild(fontLink)

const css = `
:root{
  --bg:#FFF9F5;--white:#FFFFFF;--bg2:#FFF0E6;--bg3:#FFE0CC;
  --ink:#1A0A00;--ink2:#8B4513;--ink3:#D2691E;
  --v:#EA580C;--v2:#C2410C;--v3:#9A3412;
  --pink:#F43F5E;--green:#10B981;--amber:#F59E0B;--red:#EF4444;
  --grad:linear-gradient(135deg,#EA580C,#F43F5E);
  --s1:0 2px 8px rgba(234,88,12,.08),0 8px 24px rgba(234,88,12,.05);
  --s2:0 4px 16px rgba(234,88,12,.12),0 16px 40px rgba(234,88,12,.1);
  --glass:rgba(255,255,255,.75);
  --r:14px;--r2:20px;--r3:28px;
}
body.dark{
  --bg:#0F0A00;--white:#1A1000;--bg2:#251500;--bg3:#3D2200;
  --ink:#FFF0E0;--ink2:#D2691E;--ink3:#8B4513;
  --border-clr:rgba(234,88,12,.2);
  --glass:rgba(26,16,0,.85);
  --s1:0 2px 8px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.2);
  --s2:0 4px 16px rgba(0,0,0,.4),0 16px 40px rgba(0,0,0,.3);
}
body.dark .navbar{background:rgba(15,10,0,.92)!important}
body.dark .card{border-color:rgba(234,88,12,.15)!important}
body.dark .hero{background:linear-gradient(150deg,#1A0500 0%,#3D0E00 35%,#7C2D12 65%,#C2410C 100%)!important}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);font-family:'Sora',sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--grad);border-radius:4px}

/* NAVBAR */
.navbar{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 40px;height:64px;background:rgba(255,249,245,.92);backdrop-filter:blur(20px);border-bottom:1px solid rgba(234,88,12,.1);box-shadow:0 2px 20px rgba(234,88,12,.06);animation:navDrop .6s cubic-bezier(.22,1,.36,1) both}
@keyframes navDrop{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:translateY(0)}}
.nav-logo{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:800;letter-spacing:-.04em;color:var(--ink);text-decoration:none}
.nav-gem{width:36px;height:36px;border-radius:12px;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 16px rgba(234,88,12,.4);animation:gemPulse 3s ease-in-out infinite;flex-shrink:0}
@keyframes gemPulse{0%,100%{box-shadow:0 4px 16px rgba(234,88,12,.4)}50%{box-shadow:0 6px 28px rgba(234,88,12,.65)}}
.nav-tabs{display:flex;gap:2px}
.nav-tab{padding:7px 16px;border-radius:100px;font-size:13px;font-weight:500;color:var(--ink2);cursor:pointer;border:none;background:transparent;transition:all .2s;font-family:'Sora',sans-serif}
.nav-tab:hover{background:var(--bg2);color:var(--v2)}
.nav-tab.active{background:var(--v);color:white;font-weight:700;box-shadow:0 4px 12px rgba(234,88,12,.35)}
.nav-badge{font-family:'DM Mono',monospace;font-size:11px;color:var(--ink3);background:var(--bg2);border:1px solid rgba(234,88,12,.12);padding:4px 12px;border-radius:100px}

/* HERO */
.hero{
  min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:72px 40px 96px;text-align:center;position:relative;overflow:hidden;
  background:linear-gradient(150deg,#7C2D12 0%,#B91C1C 25%,#C2410C 50%,#EA580C 75%,#F97316 100%);
}
.hero-noise{position:absolute;inset:0;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:200px;pointer-events:none}
.hero-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:56px 56px;pointer-events:none}
.hero-glow1{position:absolute;top:-120px;left:-100px;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.06) 0%,transparent 70%);pointer-events:none;animation:glowFloat1 10s ease-in-out infinite}
.hero-glow2{position:absolute;bottom:-80px;right:-60px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(244,63,94,.15) 0%,transparent 70%);pointer-events:none;animation:glowFloat2 8s ease-in-out infinite}
@keyframes glowFloat1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,-25px) scale(1.05)}}
@keyframes glowFloat2{0%,100%{transform:translate(0,0)}50%{transform:translate(-18px,18px)}}
.hero-ring1{position:absolute;top:-60px;left:-80px;width:380px;height:380px;border-radius:50%;border:1.5px solid rgba(255,255,255,.07);pointer-events:none}
.hero-ring2{position:absolute;bottom:-80px;right:-40px;width:320px;height:320px;border-radius:50%;border:1px solid rgba(255,255,255,.05);pointer-events:none}
.hero-word{position:absolute;color:rgba(255,255,255,.1);font-size:18px;font-weight:700;font-style:italic;letter-spacing:-.02em;pointer-events:none;animation:wordDrift 9s ease-in-out infinite}
@keyframes wordDrift{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-14px) rotate(1deg)}}

.hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);border-radius:100px;padding:8px 20px;font-size:12px;font-weight:700;color:white;letter-spacing:.03em;margin-bottom:28px;backdrop-filter:blur(16px);box-shadow:0 4px 20px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.2);animation:heroEl .7s .1s cubic-bezier(.22,1,.36,1) both}
.badge-dot{width:6px;height:6px;border-radius:50%;background:#FCD34D;animation:badgeDot 2s ease-in-out infinite;flex-shrink:0}
@keyframes badgeDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.5)}}

.hero-h1{font-size:clamp(3rem,7vw,5.8rem);font-weight:800;color:white;line-height:1.0;letter-spacing:-.05em;margin-bottom:22px;text-shadow:0 2px 24px rgba(0,0,0,.2);animation:heroEl .7s .18s cubic-bezier(.22,1,.36,1) both}
.hero-h1 em{font-style:italic;background:linear-gradient(135deg,#FDE68A,#FCA5A5);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 2px 8px rgba(0,0,0,.2))}

.hero-p{font-size:18px;color:rgba(255,255,255,.85);line-height:1.75;max-width:540px;margin:0 auto 44px;font-weight:400;text-shadow:0 1px 6px rgba(0,0,0,.1);animation:heroEl .7s .28s cubic-bezier(.22,1,.36,1) both}

.hero-upload-box{background:rgba(255,255,255,.13);backdrop-filter:blur(20px);border:1.5px solid rgba(255,255,255,.28);border-radius:24px;padding:28px 32px;max-width:460px;width:100%;margin:0 auto 40px;animation:heroEl .7s .38s cubic-bezier(.22,1,.36,1) both;transition:all .25s;box-shadow:0 8px 32px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.2)}
.hero-upload-box:hover{background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.45);box-shadow:0 12px 40px rgba(0,0,0,.18)}
.hero-upload-hint{color:rgba(255,255,255,.7);font-size:13px;margin-bottom:16px;font-weight:400}
.hero-file-name{color:rgba(255,255,255,.85);font-size:12px;margin:10px 0;font-family:'DM Mono',monospace;background:rgba(0,0,0,.15);padding:6px 12px;border-radius:8px}
.upload-btn-ghost{background:rgba(255,255,255,.15);color:white;font-family:'Sora',sans-serif;font-weight:600;font-size:14px;padding:11px 24px;border-radius:12px;border:1.5px solid rgba(255,255,255,.3);cursor:pointer;width:100%;transition:all .2s;backdrop-filter:blur(8px);margin-bottom:10px}
.upload-btn-ghost:hover{background:rgba(255,255,255,.25);border-color:rgba(255,255,255,.5)}
.upload-btn-white{background:white;color:var(--v2);font-family:'Sora',sans-serif;font-weight:700;font-size:14px;padding:13px 28px;border-radius:12px;border:none;cursor:pointer;width:100%;transition:all .2s;box-shadow:0 4px 16px rgba(0,0,0,.15)}
.upload-btn-white:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.2)}
.upload-btn-white:disabled{opacity:.6;cursor:not-allowed;transform:none}

.hero-chips{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;padding-top:32px;border-top:1px solid rgba(255,255,255,.1);animation:heroEl .7s .48s cubic-bezier(.22,1,.36,1) both}
.hero-chip{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.1);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.18);border-radius:100px;padding:8px 16px;font-size:13px;color:white;font-weight:600;transition:all .22s;cursor:default}
.hero-chip:hover{background:rgba(255,255,255,.2);transform:translateY(-2px);border-color:rgba(255,255,255,.35)}
.chip-icon{font-size:16px}

.hero-wave{position:absolute;bottom:-1px;left:0;right:0;height:88px;background:var(--bg);clip-path:ellipse(60% 100% at 50% 100%)}

@keyframes heroEl{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}

/* MAIN */
.main{max-width:1100px;margin:0 auto;padding:0 32px 40px}
.dash-wrap{padding:36px 0 0;animation:riseUp .5s ease both}
.dash-title{font-size:1.8rem;font-weight:800;color:var(--ink);letter-spacing:-.04em;margin-bottom:4px}
.dash-sub{font-size:14px;color:var(--ink2);margin-bottom:22px}
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
.stat-card{background:var(--glass);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.65);border-radius:var(--r2);padding:22px;box-shadow:var(--s1),inset 0 1px 0 rgba(255,255,255,.9);position:relative;overflow:hidden;transition:transform .22s,box-shadow .22s}
.stat-card:hover{transform:translateY(-4px);box-shadow:var(--s2)}
.stat-bar{position:absolute;top:0;left:0;right:0;height:3px}
.stat-icon{font-size:28px;margin-bottom:12px;display:block}
.stat-val{font-size:2.2rem;font-weight:800;letter-spacing:-.05em;color:var(--ink);line-height:1;margin-bottom:5px}
.stat-lbl{font-size:13px;color:var(--ink2)}

/* TABS */
.tab-bar{display:flex;border-bottom:1px solid rgba(234,88,12,.1);margin-bottom:20px;overflow-x:auto;gap:2px;padding-top:20px;scrollbar-width:none}
.tab-bar::-webkit-scrollbar{display:none}
.tab-btn{padding:10px 18px;font-size:13px;font-weight:500;color:var(--ink2);cursor:pointer;border:none;background:transparent;border-bottom:2px solid transparent;border-radius:8px 8px 0 0;transition:all .18s;white-space:nowrap;font-family:'Sora',sans-serif;flex-shrink:0}
.tab-btn:hover{color:var(--v);background:var(--bg2)}
.tab-btn.active{color:var(--v);font-weight:700;border-bottom:2px solid var(--v);background:rgba(234,88,12,.05)}

/* CARDS */
.card{background:var(--glass);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.6);border-radius:var(--r2);padding:24px;box-shadow:var(--s1),inset 0 1px 0 rgba(255,255,255,.9);margin-bottom:14px}
.sec-title{font-size:1.45rem;font-weight:800;color:var(--ink);letter-spacing:-.04em;margin-bottom:4px}
.sec-sub{font-size:13px;color:var(--ink2);margin-bottom:18px}

/* CHAT */
.chat-box{display:flex;flex-direction:column;gap:10px;min-height:320px;max-height:480px;overflow-y:auto;margin-bottom:14px;padding:2px}
.msg{padding:13px 17px;border-radius:var(--r2);font-size:14px;line-height:1.65;animation:msgIn .28s cubic-bezier(.22,1,.36,1) both;max-width:85%}
.msg.user{background:var(--v);color:white;align-self:flex-end;border-radius:var(--r2) var(--r2) 4px var(--r2)}
.msg.ai{background:var(--glass);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.55);color:var(--ink);align-self:flex-start;box-shadow:var(--s1)}
@keyframes msgIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
.chat-row{display:flex;gap:10px}
.chat-in{flex:1;padding:11px 16px;border:1.5px solid rgba(234,88,12,.18);border-radius:var(--r);font-family:'Sora',sans-serif;font-size:14px;background:var(--glass);backdrop-filter:blur(8px);color:var(--ink);outline:none;transition:all .2s}
.chat-in:focus{border-color:var(--v);box-shadow:0 0 0 3px rgba(234,88,12,.1)}

/* BUTTONS */
.btn{padding:9px 20px;background:var(--bg2);color:var(--v);border:1px solid rgba(234,88,12,.15);border-radius:var(--r);font-family:'Sora',sans-serif;font-weight:600;font-size:13px;cursor:pointer;transition:all .2s;white-space:nowrap}
.btn:hover{background:var(--v);color:white;transform:translateY(-1px);box-shadow:0 5px 18px rgba(234,88,12,.3)}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
.btn-p{background:var(--v);color:white;box-shadow:0 4px 14px rgba(234,88,12,.3)}
.btn-p:hover{background:var(--v2);box-shadow:0 6px 20px rgba(234,88,12,.4)}

/* FLASHCARD */
.fc{background:var(--glass);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.68);border-radius:var(--r3);padding:52px 42px;text-align:center;min-height:230px;display:flex;flex-direction:column;justify-content:center;box-shadow:var(--s2),inset 0 1px 0 rgba(255,255,255,.9);position:relative;overflow:hidden;animation:cardIn .3s cubic-bezier(.22,1,.36,1) both}
.fc::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--grad)}
.fc-lbl{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--v);margin-bottom:18px}
.fc-term{font-size:22px;font-weight:700;color:var(--ink);line-height:1.3;letter-spacing:-.02em}
.fc-def{font-size:15px;color:var(--ink2);line-height:1.65;margin-top:18px;padding-top:18px;border-top:1px solid rgba(234,88,12,.1)}

/* QUIZ */
.qcard{background:var(--glass);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.58);border-radius:var(--r2);padding:22px 26px;margin-bottom:14px;box-shadow:var(--s1)}
.qnum{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.1em;color:var(--v);margin-bottom:7px}
.qtext{font-size:17px;font-weight:700;color:var(--ink);letter-spacing:-.02em}
.qopt{background:var(--glass);backdrop-filter:blur(8px);border:1.5px solid rgba(255,255,255,.45);border-radius:var(--r);padding:13px 19px;width:100%;text-align:left;font-family:'Sora',sans-serif;font-size:14px;color:var(--ink);cursor:pointer;transition:all .17s;margin-bottom:7px;display:block}
.qopt:hover{border-color:var(--v);background:rgba(234,88,12,.04);color:var(--v)}
.qopt.correct{border-color:var(--green)!important;background:rgba(16,185,129,.07)!important;color:var(--green)!important;font-weight:600!important}
.qopt.wrong{border-color:var(--red)!important;background:rgba(239,68,68,.06)!important;color:var(--red)!important}

/* MISC */
.prog{background:var(--bg3);border-radius:100px;height:4px;margin:8px 0 4px;overflow:hidden}
.prog-fill{height:100%;border-radius:100px;background:var(--grad);transition:width .5s cubic-bezier(.4,0,.2,1)}
.inp{width:100%;padding:11px 15px;border:1.5px solid rgba(234,88,12,.16);border-radius:var(--r);font-family:'Sora',sans-serif;font-size:14px;background:var(--glass);backdrop-filter:blur(8px);color:var(--ink);outline:none;margin-bottom:11px;transition:all .2s}
.inp:focus{border-color:var(--v);box-shadow:0 0 0 3px rgba(234,88,12,.1)}
.sel{width:100%;padding:10px 13px;border:1.5px solid rgba(234,88,12,.16);border-radius:var(--r);font-family:'Sora',sans-serif;font-size:13px;background:var(--glass);color:var(--ink);outline:none;margin-bottom:11px}
.lbl{font-size:11px;font-weight:600;color:var(--ink2);margin-bottom:5px;display:block;letter-spacing:.06em;text-transform:uppercase;font-family:'DM Mono',monospace}
.chip{display:inline-flex;align-items:center;padding:3px 11px;border-radius:100px;font-size:11px;font-weight:600;background:var(--bg2);color:var(--v);border:1px solid rgba(234,88,12,.14);margin:2px}

/* FOOTER */
.footer{margin:48px 32px 28px;padding:44px 40px;background:linear-gradient(135deg,#7C2D12,#EA580C);border-radius:var(--r2);text-align:center;color:white;position:relative;overflow:hidden}
.footer::before{content:'';position:absolute;top:-50px;right:-50px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.04)}
.ft-logo{font-size:24px;font-weight:800;letter-spacing:-.04em;margin-bottom:7px}
.ft-sub{font-size:13px;color:rgba(255,255,255,.6);margin-bottom:18px;font-weight:300}
.ft-copy{font-size:11px;color:rgba(255,255,255,.35);font-family:'DM Mono',monospace}

/* ENHANCED ANIMATIONS */
@keyframes fadeInUp{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}

.card{transition:transform .25s cubic-bezier(.22,1,.36,1),box-shadow .25s!important}
.card:hover{transform:translateY(-3px)!important;box-shadow:var(--s2)!important}
.btn{transition:all .2s cubic-bezier(.22,1,.36,1)!important}
.tab-btn{transition:all .2s cubic-bezier(.22,1,.36,1)!important}

/* TYPING INDICATOR */
.typing-dot{width:6px;height:6px;border-radius:50%;background:var(--v);display:inline-block;margin:0 2px;animation:typingBounce 1.2s ease-in-out infinite}
.typing-dot:nth-child(2){animation-delay:.2s}
.typing-dot:nth-child(3){animation-delay:.4s}
@keyframes typingBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}

/* ENHANCED FOOTER */
.footer-enhanced{
  margin:48px 0 0;padding:56px 40px 40px;
  background:linear-gradient(135deg,#7C2D12 0%,#C2410C 50%,#EA580C 100%);
  position:relative;overflow:hidden;color:white;
}
.footer-enhanced::before{content:'';position:absolute;top:-80px;right:-80px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,.05);pointer-events:none}
.footer-enhanced::after{content:'';position:absolute;bottom:-40px;left:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.04);pointer-events:none}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:40px;max-width:1100px;margin:0 auto 40px;position:relative}
.footer-brand-name{font-size:28px;font-weight:800;letter-spacing:-.04em;margin-bottom:8px}
.footer-brand-sub{font-size:13px;color:rgba(255,255,255,.65);font-weight:300;line-height:1.6;margin-bottom:20px;max-width:280px}
.footer-col-title{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:14px;font-family:'DM Mono',monospace}
.footer-link{display:block;font-size:13px;color:rgba(255,255,255,.7);margin-bottom:8px;font-weight:500;transition:color .2s}
.footer-link:hover{color:white}
.footer-bottom{border-top:1px solid rgba(255,255,255,.1);padding-top:24px;display:flex;justify-content:space-between;align-items:center;max-width:1100px;margin:0 auto;position:relative}
.footer-copy-text{font-size:11px;color:rgba(255,255,255,.4);font-family:'DM Mono',monospace}
.footer-tech-pills{display:flex;gap:8px;flex-wrap:wrap}
.footer-pill{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:100px;padding:4px 12px;font-size:11px;color:rgba(255,255,255,.7);font-family:'DM Mono',monospace}

/* HERO ENHANCEMENTS */
.hero-stats{display:flex;gap:32px;justify-content:center;margin-top:32px;padding-top:28px;border-top:1px solid rgba(255,255,255,.1);animation:heroEl .7s .6s cubic-bezier(.22,1,.36,1) both}
.hero-stat{text-align:center}
.hero-stat-num{font-size:1.8rem;font-weight:800;color:white;letter-spacing:-.04em;line-height:1}
.hero-stat-lbl{font-size:11px;color:rgba(255,255,255,.6);margin-top:2px;font-family:'DM Mono',monospace;letter-spacing:.06em}

/* IMPROVED SPACING */
.main{max-width:1140px;margin:0 auto;padding:0 36px 48px}
.sec-title{font-size:1.55rem!important}

@media(max-width:768px){
  .footer-grid{grid-template-columns:1fr}
  .footer-bottom{flex-direction:column;gap:12px;text-align:center}
  .main{padding:0 16px 32px}
}

/* ACHIEVEMENTS */
.achievement{display:flex;align-items:center;gap:12px;padding:12px 16px;background:linear-gradient(135deg,rgba(234,88,12,.06),rgba(244,63,94,.04));border:1px solid rgba(234,88,12,.15);border-radius:14px;margin-bottom:8px;animation:riseUp .3s ease both}
.ach-icon{font-size:28px;flex-shrink:0}
.ach-name{font-size:14px;font-weight:700;color:var(--ink);letter-spacing:-.02em}
.ach-desc{font-size:12px;color:var(--ink2)}
.ach-locked{opacity:.4;filter:grayscale(1)}

/* STREAK */
.streak-card{background:linear-gradient(135deg,#EA580C,#F43F5E);border-radius:var(--r2);padding:20px 24px;color:white;margin-bottom:16px;position:relative;overflow:hidden}
.streak-card::before{content:'';position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08)}
.streak-num{font-size:3rem;font-weight:800;letter-spacing:-.05em;line-height:1}
.streak-lbl{font-size:13px;color:rgba(255,255,255,.75);font-weight:300}

/* COMPARE */
.compare-col{flex:1;background:var(--glass);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.6);border-radius:var(--r2);padding:20px;box-shadow:var(--s1)}

/* EXPORT MODAL */
.modal-overlay{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px}
.modal-box{background:var(--white);border-radius:24px;padding:28px;max-width:520px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2);animation:riseUp .3s ease both}


.spin{width:16px;height:16px;border:2px solid rgba(234,88,12,.2);border-top-color:currentColor;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;vertical-align:middle;margin-right:5px}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes riseUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes voicePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
@keyframes cardIn{from{opacity:0;transform:scale(.96) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}

@media(max-width:768px){
  .navbar{padding:0 16px}
  .nav-tabs,.nav-badge{display:none}
  .hero{padding:56px 20px 80px}
  .hero-h1{font-size:2.5rem}
  .hero-p{font-size:15px}
  .stat-grid{grid-template-columns:1fr 1fr}
  .main{padding:0 14px 32px}
  .footer{margin:36px 14px 20px;padding:28px 20px}
}
`
const el = document.createElement("style")
el.textContent = css
document.head.appendChild(el)

function Spin(){return <span className="spin"/>}

function Nav({tab,setTab,ok,dark,onDark,notifs,onClearNotifs}){
  const ts=["Chat","Notes","Flashcards","Quiz","YouTube","Essay","ELI5","🎮 Vocab","⏱️ Timer","🏆"]
  return(
    <nav className="navbar">
      <div className="nav-logo">
        <div className="nav-gem">🧠</div>
        <div>
          <div style={{fontSize:18,fontWeight:800,letterSpacing:"-.04em",lineHeight:1}}>MindLearn</div>
          <div style={{fontSize:9,fontFamily:"DM Mono,monospace",color:"var(--ink3)",letterSpacing:".1em",textTransform:"uppercase",lineHeight:1}}>AI Study Platform</div>
        </div>
      </div>
      <div className="nav-tabs">{ts.map(t=><button key={t} className={"nav-tab"+(tab===t?" active":"")} onClick={()=>setTab(t)}>{t}</button>)}</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={onDark} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,padding:"4px 8px",borderRadius:8}} title="Toggle dark mode">{dark?"☀️":"🌙"}</button>
        <NotificationBell notifications={notifs} onClear={onClearNotifs}/>
        <div className="nav-badge">{ok?"✅ PDF ready":"groq · llama3.3"}</div>
      </div>
    </nav>
  )
}

function Hero({onUp,busy}){
  const ref=useRef()
  const [fs,setFs]=useState([])
  return(
    <section className="hero">
      <div className="hero-noise"/><div className="hero-grid"/>
      <div className="hero-glow1"/><div className="hero-glow2"/>
      <div className="hero-ring1"/><div className="hero-ring2"/>
      {[["Flashcards","12%","4%","0s"],["Quiz","15%","right:5%","1.5s"],["Notes","bottom:20%","6%","3s"],["Essays","bottom:26%","right:4%","4.5s"]].map(([w,t,l,d])=>(
        <div key={w} className="hero-word" style={{top:t.includes("bottom")?"":t,[t.includes("bottom")?"bottom":"top"]:t.replace("bottom:",""),left:l.includes("right")?"":l,right:l.includes("right")?l.replace("right:",""):"",animationDelay:d}}>{w}</div>
      ))}
      <div className="hero-badge"><div className="badge-dot"/>✨ Groq AI · Blazing Fast · 100% Private</div>
      <h1 className="hero-h1">Your PDF just got<br/><em>a superpower.</em></h1>
      <p className="hero-p">Drop any PDF and watch AI instantly create notes, flashcards, quizzes and more. Study smarter, stress less.</p>
      <div className="hero-upload-box">
        <p className="hero-upload-hint">📄 Upload your PDF to get started</p>
        <input ref={ref} type="file" accept=".pdf" multiple style={{display:"none"}} onChange={e=>setFs([...e.target.files])}/>
        <button className="upload-btn-ghost" onClick={()=>ref.current.click()}>📁 Choose Files</button>
        {fs.length>0&&<>
          <div className="hero-file-name">{fs.map(f=>f.name).join(", ")}</div>
          <button className="upload-btn-white" disabled={busy} onClick={()=>{const fd=new FormData();fs.forEach(f=>fd.append("files",f));onUp(fd)}}>
            {busy?<><Spin/>Processing...</>:"⚡ Process & Start Learning"}
          </button>
        </>}
      </div>
      <div className="hero-chips">
        {[["🤖","AI Tutor"],["📝","Notes"],["🃏","Flashcards"],["🧪","Quiz"],["🎬","YouTube"],["✍️","Essay"],["🧒","ELI5"]].map(([ic,lb])=>(
          <div key={lb} className="hero-chip"><span className="chip-icon">{ic}</span>{lb}</div>
        ))}
      </div>
      <div className="hero-stats">
        {[["15+","AI Features"],["⚡","Groq Powered"],["100%","Private"],["0$","Free Forever"]].map(([n,l])=>(
          <div key={l} className="hero-stat">
            <div className="hero-stat-num">{n}</div>
            <div className="hero-stat-lbl">{l}</div>
          </div>
        ))}
      </div>
      <div className="hero-wave"/>
    </section>
  )
}

function Dash({info}){
  return(
    <div className="dash-wrap">
      <div className="dash-title">Dashboard</div>
      <div className="dash-sub">Your study session at a glance</div>
      <div className="stat-grid">
        {[
          {ic:"📄",v:info.files||0,lb:"PDFs loaded",g:"linear-gradient(90deg,#EA580C,#F43F5E)"},
          {ic:"🧩",v:info.chunks||0,lb:"Chunks indexed",g:"linear-gradient(90deg,#FB923C,#EA580C)"},
          {ic:"💬",v:info.q||0,lb:"Questions asked",g:"linear-gradient(90deg,#F43F5E,#FB923C)"},
          {ic:"🃏",v:info.fc||0,lb:"Flashcards made",g:"linear-gradient(90deg,#C2410C,#EA580C)"},
        ].map(s=>(
          <div key={s.lb} className="stat-card">
            <div className="stat-bar" style={{background:s.g}}/>
            <span className="stat-icon">{s.ic}</span>
            <div className="stat-val">{s.v}</div>
            <div className="stat-lbl">{s.lb}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Chat({lang,onQ,addBm}){
  const [msgs,setMsgs]=useState(()=>JSON.parse(localStorage.getItem("ml_chat")||"[]"))
  const [inp,setInp]=useState("")
  const [busy,setBusy]=useState(false)
  const [personality,setPersonality]=useState("Friendly")
  const end=useRef()
  useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"})},[msgs])
  useEffect(()=>{localStorage.setItem("ml_chat",JSON.stringify(msgs.slice(-50)))},[msgs])

  const send=async()=>{
    if(!inp.trim())return
    const q=inp;setInp("")
    setMsgs(m=>[...m,{r:"user",t:q}])
    setBusy(true)
    try{
      const p=PERSONALITIES[personality]
      const{data}=await axios.post(API+"/chat",{question:q,language:lang,personality:p.prompt})
      setMsgs(m=>[...m,{r:"ai",t:data.answer}])
      onQ&&onQ()
    }
    catch{setMsgs(m=>[...m,{r:"ai",t:"Error — is PDF uploaded?"}])}
    setBusy(false)
  }
  return(
    <div>
      <div className="sec-title">💬 AI Tutor</div>
      <div className="sec-sub">Ask anything from your PDF</div>
      {/* Personality Selector */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {Object.entries(PERSONALITIES).map(([k,v])=>(
          <button key={k} className={"btn"+(personality===k?" btn-p":"")} style={{width:"auto",padding:"5px 12px",fontSize:12}} onClick={()=>setPersonality(k)}>
            {v.icon} {k}
          </button>
        ))}
        <button className="btn" style={{width:"auto",padding:"5px 12px",fontSize:12,marginLeft:"auto"}} onClick={()=>{setMsgs([]);localStorage.removeItem("ml_chat")}}>🗑 Clear</button>
      </div>
      <div className="card">
        <div className="chat-box">
          {!msgs.length&&<div style={{color:"var(--ink2)",fontSize:14,textAlign:"center",paddingTop:60}}>
            <div style={{fontSize:32,marginBottom:8}}>{PERSONALITIES[personality].icon}</div>
            <div style={{fontWeight:600,marginBottom:4}}>{personality} Mode</div>
            <div style={{fontSize:12}}>{PERSONALITIES[personality].desc}</div>
          </div>}
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,justifyContent:m.r==="user"?"flex-end":"flex-start"}}>
              <div className={"msg "+(m.r)} style={{maxWidth:"85%"}}>{m.t}</div>
              {m.r==="ai"&&<div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}><button onClick={()=>addBm({id:Date.now(),question:msgs[i-1]?.t||"",answer:m.t,date:new Date().toLocaleDateString(),type:"Chat"})} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"4px 2px",color:"var(--ink3)"}} title="Bookmark">🔖</button><CopyBtn text={m.t}/></div>}
            </div>
          ))}
          {busy&&<div className="msg ai" style={{padding:"14px 18px"}}>
              <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
            </div>}
          <div ref={end}/>
        </div>
        <div style={{marginBottom:8}}>
          <SearchChat msgs={msgs} onSelect={t=>setInp(t)}/>
        </div>
        <div className="chat-row">
          <VoiceInput onResult={t=>setInp(i=>i+t+" ")} lang={lang}/>
          <input className="chat-in" value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={"Ask "+(PERSONALITIES[personality].icon)+" "+(personality)+" tutor..."}/>
          <button className="btn btn-p" onClick={send} disabled={busy||!inp.trim()}>Send</button>
        </div>
      </div>
    </div>
  )
}

function Notes({lang,onShare,onDone}){
  const [txt,setTxt]=useState("")
  const [busy,setBusy]=useState(false)
  const gen=async()=>{setBusy(true);try{const{data}=await axios.post(API+"/notes",{language:lang});setTxt(data.notes);onDone&&onDone()}catch{alert("Error!")}setBusy(false)}
  return(
    <div>
      <div className="sec-title">📝 Smart Notes</div>
      <div className="sec-sub">Auto-generate structured notes from your PDF</div>
      <button className="btn btn-p" onClick={gen} disabled={busy} style={{marginBottom:16,width:"auto"}}>{busy?<><Spin/>Generating...</>:"✨ Generate Notes"}</button>
      {txt&&<div className="card" style={{whiteSpace:"pre-wrap",fontSize:14,lineHeight:1.7}}>{txt}<div style={{marginTop:14,display:"flex",gap:10}}><a href={"data:text/plain;charset=utf-8,"+(encodeURIComponent(txt))} download="notes.txt"><button className="btn" style={{width:"auto"}}>⬇️ Download</button></a><button className="btn btn-p" style={{width:"auto"}} onClick={()=>onShare&&onShare(txt)}>📤 Share</button></div></div>}
    </div>
  )
}

function Flashcards({lang,onDone}){
  const [cards,setCards]=useState([])
  const [i,setI]=useState(0)
  const [show,setShow]=useState(false)
  const [busy,setBusy]=useState(false)
  const gen=async()=>{setBusy(true);try{const{data}=await axios.post(API+"/flashcards",{language:lang});setCards(data.flashcards);setI(0);setShow(false);onDone&&onDone(data.flashcards.length)}catch{alert("Error!")}setBusy(false)}
  return(
    <div>
      <div className="sec-title">🃏 Flashcards</div>
      <div className="sec-sub">Auto-generated term & definition cards</div>
      <button className="btn btn-p" onClick={gen} disabled={busy} style={{marginBottom:18,width:"auto"}}>{busy?<><Spin/>Generating...</>:"🃏 Generate Flashcards"}</button>
      {cards.length>0&&<>
        <div className="prog"><div className="prog-fill" style={{width:`${(i/cards.length)*100}%`}}/></div>
        <p style={{fontSize:12,color:"var(--ink2)",marginBottom:10,textAlign:"right"}}>{i+1}/{cards.length}</p>
        <div className="fc" key={i}>
          <div className="fc-lbl">{show?"ANSWER":"TERM"}</div>
          <div className="fc-term">{cards[i].term}</div>
          {show&&<div className="fc-def">{cards[i].definition}</div>}
        </div>
        <div style={{display:"flex",gap:10,marginTop:14}}>
          <button className="btn" disabled={i===0} onClick={()=>{setI(x=>x-1);setShow(false)}}>◀</button>
          <button className="btn btn-p" onClick={()=>setShow(s=>!s)} style={{flex:1}}>{show?"Hide Answer":"Show Answer"}</button>
          <button className="btn" disabled={i===cards.length-1} onClick={()=>{setI(x=>x+1);setShow(false)}}>▶</button>
        </div>
      </>}
    </div>
  )
}

function Quiz({lang,onDone}){
  const [showConfetti,setShowConfetti]=useState(false)
  const [qs,setQs]=useState([])
  const [qi,setQi]=useState(0)
  const [sc,setSc]=useState(0)
  const [sel,setSel]=useState(null)
  const [ans,setAns]=useState(false)
  const [done,setDone]=useState(false)
  const [busy,setBusy]=useState(false)
  const [diff,setDiff]=useState("Mixed")
  const gen=async()=>{setBusy(true);try{const{data}=await axios.post(API+"/quiz",{language:lang,difficulty:diff});setQs(data.questions);setQi(0);setSc(0);setSel(null);setAns(false);setDone(false)}catch{alert("Error!")}setBusy(false)}
  const pick=o=>{if(ans)return;setSel(o);setAns(true);if(o===qs[qi].answer)setSc(s=>s+1)}
  const next=()=>{if(qi+1<qs.length){setQi(x=>x+1);setSel(null);setAns(false)}else{setDone(true);onDone&&onDone(sc+1,qs.length);setShowConfetti(true);setTimeout(()=>setShowConfetti(false),3500)}}
  return(
    <div>
      {showConfetti&&<Confetti/>}
      <div className="sec-title">🧪 Quiz Mode</div>
      <div className="sec-sub">Test your knowledge with AI-generated MCQs</div>
      {(!qs.length||done)&&<>
        {done&&<div className="card" style={{textAlign:"center",padding:36}}><div style={{fontSize:"3.2rem",fontWeight:800,letterSpacing:"-.05em",color:sc/qs.length>=.7?"var(--green)":"var(--v)",marginBottom:6}}>{sc}/{qs.length}</div><div style={{color:"var(--ink2)"}}>{Math.round(sc/qs.length*100)}% correct</div></div>}
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
          <select className="sel" style={{width:"auto",marginBottom:0}} value={diff} onChange={e=>setDiff(e.target.value)}>{["Mixed","Easy","Medium","Hard"].map(d=><option key={d}>{d}</option>)}</select>
          <button className="btn btn-p" onClick={gen} disabled={busy} style={{width:"auto"}}>{busy?<><Spin/>...</>:done?"🔄 Retake":"🧪 Start Quiz"}</button>
        </div>
      </>}
      {qs.length>0&&!done&&<>
        <div className="prog"><div className="prog-fill" style={{width:`${(qi/qs.length)*100}%`}}/></div>
        <p style={{fontSize:12,color:"var(--ink2)",margin:"5px 0 14px",textAlign:"right"}}>Q{qi+1}/{qs.length} · Score:{sc}</p>
        <div className="qcard"><div className="qnum">QUESTION {qi+1}</div><div className="qtext">{qs[qi].question}</div></div>
        {qs[qi].options.map(o=>{let c="qopt";if(ans){if(o===qs[qi].answer)c+=" correct";else if(o===sel)c+=" wrong"}return<button key={o} className={c} onClick={()=>pick(o)} disabled={ans}>{o}</button>})}
        {ans&&<button className="btn btn-p" onClick={next} style={{marginTop:8,width:"auto"}}>{qi+1<qs.length?"Next ▶":"Results 🏁"}</button>}
      </>}
    </div>
  )
}

function YouTube(){
  const [url,setUrl]=useState("")
  const [notes,setNotes]=useState("")
  const [vid,setVid]=useState("")
  const [busy,setBusy]=useState(false)
  const gen=async()=>{setBusy(true);try{const{data}=await axios.post(API+"/youtube",{url});setNotes(data.notes);setVid(data.video_id)}catch(e){alert(e.response?.data?.detail||"Error!")}setBusy(false)}
  return(
    <div>
      <div className="sec-title">🎬 YouTube → Notes</div>
      <div className="sec-sub">Paste any YouTube URL and get instant AI notes</div>
      <input className="inp" placeholder="https://www.youtube.com/watch?v=..." value={url} onChange={e=>setUrl(e.target.value)}/>
      <button className="btn btn-p" onClick={gen} disabled={busy||!url} style={{width:"auto",marginBottom:18}}>{busy?<><Spin/>Fetching...</>:"📝 Generate Notes"}</button>
      {vid&&<div className="card" style={{display:"flex",gap:14,alignItems:"center",marginBottom:14}}><img src={"https://img.youtube.com/vi/"+(vid)+"/mqdefault.jpg"} style={{width:130,borderRadius:10,flexShrink:0}} alt=""/><div><div style={{fontSize:11,color:"var(--ink3)",fontFamily:"DM Mono",marginBottom:4}}>YOUTUBE VIDEO</div><a href={url} target="_blank" rel="noreferrer" style={{color:"var(--v)",fontSize:14,fontWeight:600}}>▶ Watch</a></div></div>}
      {notes&&<div className="card" style={{whiteSpace:"pre-wrap",fontSize:14,lineHeight:1.7}}>{notes}</div>}
    </div>
  )
}

function Essay({lang,onShare}){
  const [topic,setTopic]=useState("")
  const [type,setType]=useState("Argumentative Essay")
  const [wc,setWc]=useState(500)
  const [txt,setTxt]=useState("")
  const [busy,setBusy]=useState(false)
  const gen=async()=>{setBusy(true);try{const{data}=await axios.post(API+"/essay",{topic,essay_type:type,word_count:wc,language:lang});setTxt(data.essay)}catch{alert("Error!")}setBusy(false)}
  return(
    <div>
      <div className="sec-title">✍️ Essay Writer</div>
      <div className="sec-sub">AI-powered essay & assignment generator</div>
      <div className="card">
        <input className="inp" placeholder="e.g. Impact of AI on Education" value={topic} onChange={e=>setTopic(e.target.value)}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label className="lbl">Type</label><select className="sel" value={type} onChange={e=>setType(e.target.value)}>{["Argumentative Essay","Descriptive Essay","Analytical Essay","Narrative Essay","Compare & Contrast","Research Summary","Assignment Answer"].map(t=><option key={t}>{t}</option>)}</select></div>
          <div><label className="lbl">Words</label><select className="sel" value={wc} onChange={e=>setWc(Number(e.target.value))}>{[250,500,750,1000,1500,2000].map(w=><option key={w}>{w}</option>)}</select></div>
        </div>
        <button className="btn btn-p" onClick={gen} disabled={busy||!topic} style={{width:"auto"}}>{busy?<><Spin/>Writing...</>:"✍️ Write Essay"}</button>
      </div>
      {txt&&<div className="card" style={{whiteSpace:"pre-wrap",fontSize:14,lineHeight:1.8,marginTop:14}}><div style={{marginBottom:10}}><span className="chip">{txt.split(" ").length} words</span><span className="chip">{type}</span></div>{txt}<div style={{marginTop:14,display:"flex",gap:10}}><a href={"data:text/plain;charset=utf-8,"+(encodeURIComponent(txt))} download="essay.txt"><button className="btn" style={{width:"auto"}}>⬇️ Download</button></a><button className="btn btn-p" style={{width:"auto"}} onClick={()=>onShare&&onShare(txt)}>📤 Share</button></div></div>}
    </div>
  )
}

function ELI5({lang}){
  const [concept,setConcept]=useState("")
  const [style,setStyle]=useState("10-year-old kid")
  const [txt,setTxt]=useState("")
  const [busy,setBusy]=useState(false)
  const go=async()=>{setBusy(true);try{const{data}=await axios.post(API+"/eli5",{concept,style,language:lang});setTxt(data.explanation)}catch{alert("Error!")}setBusy(false)}
  return(
    <div>
      <div className="sec-title">🧒 Simple Explainer</div>
      <div className="sec-sub">Any complex concept — explained simply</div>
      <div className="card">
        <input className="inp" placeholder="e.g. Quantum Physics, Neural Networks..." value={concept} onChange={e=>setConcept(e.target.value)}/>
        <label className="lbl">Explain for</label>
        <select className="sel" value={style} onChange={e=>setStyle(e.target.value)}>{["10-year-old kid","Grandparent","Complete beginner","Sports analogy","Food analogy"].map(s=><option key={s}>{s}</option>)}</select>
        <button className="btn btn-p" onClick={go} disabled={busy||!concept} style={{width:"auto"}}>{busy?<><Spin/>Thinking...</>:"🧒 Explain Simply!"}</button>
      </div>
      {txt&&<div className="card" style={{fontSize:15,lineHeight:1.8,marginTop:14}}>{txt}</div>}
    </div>
  )
}

// ── Streak & Achievements ──
const ACHIEVEMENTS = [
  {id:"first_chat",   icon:"💬", name:"First Question",    desc:"Asked your first AI question",    check:i=>i.q>=1},
  {id:"power_user",   icon:"⚡", name:"Power User",         desc:"Asked 10 questions",               check:i=>i.q>=10},
  {id:"note_taker",   icon:"📝", name:"Note Taker",         desc:"Generated your first notes",       check:i=>i.notes>=1},
  {id:"card_master",  icon:"🃏", name:"Card Master",        desc:"Created 8 flashcards",             check:i=>i.fc>=8},
  {id:"quiz_ace",     icon:"🧪", name:"Quiz Ace",           desc:"Completed a quiz",                 check:i=>i.quiz>0},
  {id:"yt_learner",   icon:"🎬", name:"YouTube Learner",    desc:"Converted a YouTube video",        check:i=>i.yt>=1},
  {id:"essay_writer", icon:"✍️", name:"Essay Writer",        desc:"Wrote your first essay",           check:i=>i.essay>=1},
  {id:"polyglot",     icon:"🌐", name:"Polyglot",           desc:"Used Hindi or Hinglish mode",      check:i=>i.lang>=1},
]

function AchievementsPanel({info}){
  return(
    <div>
      <div className="sec-title">🏆 Achievements</div>
      <div className="sec-sub">Unlock badges as you study more</div>
      <div className="streak-card">
        <div className="streak-num">🔥 {info.streak||1}</div>
        <div className="streak-lbl">Day streak — keep it up!</div>
      </div>
      {ACHIEVEMENTS.map(a=>{
        const unlocked=a.check(info)
        return(
          <div key={a.id} className={"achievement"+(unlocked?"":" ach-locked")}>
            <div className="ach-icon">{a.icon}</div>
            <div>
              <div className="ach-name">{a.name} {unlocked?"✅":""}</div>
              <div className="ach-desc">{a.desc}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── PDF Compare ──
function CompareTab(){
  const [q,setQ]=useState("")
  const [result,setResult]=useState("")
  const [busy,setBusy]=useState(false)
  const ask=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{question:`Compare the two documents on: ${q}`,language:"English"})
      setResult(data.answer)
    }catch{alert("Upload multiple PDFs first!")}
    setBusy(false)
  }
  return(
    <div>
      <div className="sec-title">🆚 Multi-PDF Compare</div>
      <div className="sec-sub">Upload multiple PDFs and compare them</div>
      <div className="card" style={{background:"linear-gradient(135deg,rgba(234,88,12,.04),rgba(244,63,94,.02))"}}>
        <div style={{fontSize:13,color:"var(--ink2)",marginBottom:12}}>💡 Upload multiple PDFs from hero page, then ask comparison questions</div>
        <input className="inp" placeholder="e.g. Compare the key differences between both documents..." value={q} onChange={e=>setQ(e.target.value)}/>
        <button className="btn btn-p" onClick={ask} disabled={busy||!q} style={{width:"auto"}}>{busy?<><Spin/>Comparing...</>:"🆚 Compare"}</button>
      </div>
      {result&&<div className="card" style={{fontSize:14,lineHeight:1.7,marginTop:14}}>{result}</div>}
    </div>
  )
}

// ── Export to PDF ──
function ExportModal({content,title,onClose}){
  const printRef=useRef()
  const exportPDF=()=>{
    const w=window.open("","_blank")
    w.document.write(`
      <html><head><title>${title}</title>
      <style>body{font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1A0A00;line-height:1.7}
      h1{color:#EA580C;margin-bottom:8px}h2{color:#C2410C;margin-top:24px}
      pre{white-space:pre-wrap;font-family:inherit}</style></head>
      <body><h1>🧠 MindLearn AI — ${title}</h1><hr/>
      <pre>${content}</pre>
      <hr/><p style="color:#888;font-size:12px">Generated by MindLearn AI · ${new Date().toLocaleDateString()}</p>
      </body></html>
    `)
    w.document.close()
    w.print()
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:18,fontWeight:800,color:"var(--ink)",marginBottom:6}}>📄 Export as PDF</div>
        <div style={{fontSize:13,color:"var(--ink2)",marginBottom:20}}>Print or save as PDF using your browser</div>
        <div style={{background:"var(--bg2)",borderRadius:12,padding:16,marginBottom:16,maxHeight:200,overflow:"auto"}}>
          <pre style={{fontSize:12,color:"var(--ink2)",whiteSpace:"pre-wrap",fontFamily:"DM Mono"}}>{content?.substring(0,400)}...</pre>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn btn-p" onClick={exportPDF} style={{flex:1}}>🖨️ Print / Save PDF</button>
          <button className="btn" onClick={onClose} style={{width:"auto"}}>✕ Close</button>
        </div>
      </div>
    </div>
  )
}

// ── AI Image Generator ──
function ImageGenTab(){
  const [prompt,setPrompt]=useState("")
  const [style,setStyle]=useState("Digital Art")
  const [busy,setBusy]=useState(false)
  const [imgUrl,setImgUrl]=useState("")

  const generate=async()=>{
    setBusy(true)
    try{
      // Use Pollinations.ai - free, no API key needed
      const full=encodeURIComponent(`${prompt}, ${style}, educational, high quality, detailed`)
      const url=`https://image.pollinations.ai/prompt/${full}?width=800&height=500&nologo=true`
      setImgUrl(url)
    }catch{alert("Error generating image!")}
    setBusy(false)
  }

  const genFromPDF=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/notes",{language:"English"})
      const summary=data.notes.substring(0,200)
      const full=encodeURIComponent(`Visual concept map of: ${summary}, ${style}, educational diagram, colorful, high quality`)
      setImgUrl(`https://image.pollinations.ai/prompt/${full}?width=800&height=500&nologo=true`)
    }catch{alert("Upload a PDF first!")}
    setBusy(false)
  }

  return(
    <div>
      <div className="sec-title">🎨 AI Image Generator</div>
      <div className="sec-sub">Generate visual concept art from your notes or any prompt</div>
      <div className="card">
        <input className="inp" placeholder="e.g. Neural network diagram, photosynthesis process..." value={prompt} onChange={e=>setPrompt(e.target.value)}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label className="lbl">Art Style</label>
            <select className="sel" value={style} onChange={e=>setStyle(e.target.value)}>
              {["Digital Art","Watercolor","Minimalist","Infographic","3D Render","Cartoon","Blueprint"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn btn-p" onClick={generate} disabled={busy||!prompt} style={{flex:1}}>{busy?<><Spin/>Generating...</>:"🎨 Generate Image"}</button>
          <button className="btn" onClick={genFromPDF} disabled={busy} style={{flex:1}}>📄 From PDF Content</button>
        </div>
      </div>
      {busy&&<div className="card" style={{textAlign:"center",padding:40,color:"var(--ink2)",fontSize:14}}><Spin/> Creating your image... (~5 seconds)</div>}
      {imgUrl&&!busy&&(
        <div className="card" style={{padding:0,overflow:"hidden",marginTop:14}}>
          <img src={imgUrl} alt="AI generated" style={{width:"100%",display:"block",borderRadius:"var(--r2) var(--r2) 0 0"}} onError={()=>setImgUrl("")}/>
          <div style={{padding:"14px 16px",display:"flex",gap:10,background:"var(--glass)",backdropFilter:"blur(8px)"}}>
            <button className="btn btn-p" style={{flex:1}} onClick={()=>window.open(imgUrl,"_blank")}>🔗 Open Full Image</button>
            <button className="btn" style={{flex:1}} onClick={()=>{const a=document.createElement("a");a.href=imgUrl;a.target="_blank";a.download="mindlearn.jpg";a.click()}}>⬇️ Download</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dark Mode Hook ──
function useDark(){
  const [dark,setDark]=useState(()=>localStorage.getItem("ml_dark")==="1")
  useEffect(()=>{
    document.body.classList.toggle("dark",dark)
    localStorage.setItem("ml_dark",dark?"1":"0")
  },[dark])
  return [dark,setDark]
}

// ── Chat History ──
function useChatHistory(){
  const [history,setHistory]=useState(()=>JSON.parse(localStorage.getItem("ml_chat")||"[]"))
  const save=msgs=>{localStorage.setItem("ml_chat",JSON.stringify(msgs.slice(-50)))}
  const clear=()=>{localStorage.removeItem("ml_chat");setHistory([])}
  return [history,setHistory,save,clear]
}

// ── Pomodoro Timer ──
function PomodoroTab(){
  const [mode,setMode]=useState("work")
  const TIMES={work:25*60,short:5*60,long:15*60}
  const [left,setLeft]=useState(TIMES.work)
  const [running,setRunning]=useState(false)
  const [sessions,setSessions]=useState(0)
  const ref=useRef()

  useEffect(()=>{
    if(running&&left>0){ref.current=setInterval(()=>setLeft(l=>l-1),1000)}
    else if(left===0){clearInterval(ref.current);setRunning(false);setSessions(s=>s+1);try{new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAA").play()}catch{}}
    return()=>clearInterval(ref.current)
  },[running,left])

  const setM=m=>{setMode(m);setLeft(TIMES[m]);setRunning(false);clearInterval(ref.current)}
  const mins=String(Math.floor(left/60)).padStart(2,"0")
  const secs=String(left%60).padStart(2,"0")
  const pct=Math.round((1-left/TIMES[mode])*100)
  const colors={work:"#EA580C",short:"#10B981",long:"#3B82F6"}

  return(
    <div>
      <div className="sec-title">⏱️ Pomodoro Timer</div>
      <div className="sec-sub">Stay focused — 25 min work, 5 min break</div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["work","🎯 Work 25m"],["short","☕ Break 5m"],["long","🛋️ Long 15m"]].map(([m,l])=>(
          <button key={m} className={"btn"+(mode===m?" btn-p":"")} style={{flex:1,fontSize:12}} onClick={()=>setM(m)}>{l}</button>
        ))}
      </div>
      <div className="card" style={{textAlign:"center",padding:"40px 24px"}}>
        <div style={{fontSize:11,fontFamily:"DM Mono",letterSpacing:".15em",color:colors[mode],marginBottom:16,textTransform:"uppercase"}}>
          {mode==="work"?"FOCUS TIME":mode==="short"?"SHORT BREAK":"LONG BREAK"}
        </div>
        <div style={{position:"relative",width:160,height:160,margin:"0 auto 24px"}}>
          <svg width="160" height="160" style={{transform:"rotate(-90deg)"}}>
            <circle cx="80" cy="80" r="70" fill="none" stroke="var(--bg3)" strokeWidth="8"/>
            <circle cx="80" cy="80" r="70" fill="none" stroke={colors[mode]} strokeWidth="8"
              strokeDasharray={(2*Math.PI*70)} strokeDashoffset={(2*Math.PI*70*(1-pct/100))}
              style={{transition:"stroke-dashoffset .5s ease"}}/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
            <div style={{fontSize:"2.4rem",fontWeight:800,letterSpacing:"-.04em",color:"var(--ink)"}}>{mins}:{secs}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:16}}>
          <button className="btn btn-p" onClick={()=>setRunning(r=>!r)} style={{minWidth:100}}>
            {running?"⏸ Pause":"▶ Start"}
          </button>
          <button className="btn" onClick={()=>{clearInterval(ref.current);setRunning(false);setLeft(TIMES[mode])}}>↺ Reset</button>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:10,height:10,borderRadius:"50%",background:i<sessions?"var(--v)":"var(--bg3)",transition:"background .3s"}}/>)}
        </div>
        <div style={{fontSize:12,color:"var(--ink2)",marginTop:8}}>{sessions}/4 sessions done</div>
      </div>
    </div>
  )
}

// ── Vocabulary Quiz Game ──
function VocabQuizTab({lang}){
  const [words,setWords]=useState([])
  const [qi,setQi]=useState(0)
  const [score,setScore]=useState(0)
  const [inp,setInp]=useState("")
  const [result,setResult]=useState(null)
  const [done,setDone]=useState(false)
  const [busy,setBusy]=useState(false)

  const load=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/flashcards",{language:lang})
      setWords(data.flashcards.sort(()=>Math.random()-.5))
      setQi(0);setScore(0);setInp("");setResult(null);setDone(false)
    }catch{alert("Upload PDF first!")}
    setBusy(false)
  }

  const check=()=>{
    const correct=words[qi].definition.toLowerCase().includes(inp.toLowerCase().trim())||
                  inp.toLowerCase().trim().includes(words[qi].term.toLowerCase().substring(0,4))
    setResult(correct)
    if(correct)setScore(s=>s+1)
  }

  const next=()=>{
    setInp("");setResult(null)
    if(qi+1<words.length)setQi(i=>i+1)
    else setDone(true)
  }

  return(
    <div>
      <div className="sec-title">🎮 Vocabulary Quiz</div>
      <div className="sec-sub">Type the definition — test your knowledge!</div>
      {!words.length||done?(
        <>
          {done&&<div className="card" style={{textAlign:"center",padding:32,marginBottom:16}}>
            <div style={{fontSize:"3rem",fontWeight:800,color:"var(--v)",letterSpacing:"-.05em"}}>{score}/{words.length}</div>
            <div style={{color:"var(--ink2)",marginTop:6}}>{Math.round(score/words.length*100)}% correct!</div>
          </div>}
          <button className="btn btn-p" onClick={load} disabled={busy} style={{width:"auto"}}>{busy?<><Spin/>Loading...</>:"🎮 Start Vocab Quiz"}</button>
        </>
      ):(
        <>
          <div className="prog"><div className="prog-fill" style={{width:`${(qi/words.length)*100}%`}}/></div>
          <p style={{fontSize:12,color:"var(--ink2)",margin:"5px 0 14px",textAlign:"right"}}>Word {qi+1}/{words.length} · Score:{score}</p>
          <div className="qcard">
            <div className="qnum">DEFINE THIS TERM</div>
            <div className="qtext" style={{fontSize:"1.5rem",letterSpacing:"-.03em"}}>{words[qi].term}</div>
          </div>
          <input className="inp" placeholder="Type the definition..." value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!result&&check()} disabled={!!result}/>
          {!result?(
            <button className="btn btn-p" onClick={check} disabled={!inp.trim()} style={{width:"auto"}}>✓ Check</button>
          ):(
            <>
              <div className="card" style={{background:result?"rgba(16,185,129,.08)":"rgba(239,68,68,.06)",border:`1px solid ${result?"var(--green)":"var(--red)"}`,marginBottom:12}}>
                <div style={{fontWeight:700,color:result?"var(--green)":"var(--red)",marginBottom:6}}>{result?"✅ Correct!":"❌ Not quite"}</div>
                <div style={{fontSize:13,color:"var(--ink2)"}}><b>Definition:</b> {words[qi].definition}</div>
              </div>
              <button className="btn btn-p" onClick={next} style={{width:"auto"}}>{qi+1<words.length?"Next ▶":"See Results 🏁"}</button>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Concept Map Visual ──
function ConceptMapTab(){
  const [data,setData]=useState(null)
  const [busy,setBusy]=useState(false)

  const generate=async()=>{
    setBusy(true)
    try{
      const{data:r}=await axios.post(API+"/chat",{question:"List the 5 main topics and 3 subtopics each as JSON: {topics:[{name,subtopics:[]}]}",language:"English"})
      const match=r.answer.match(/\{[\s\S]*\}/)
      if(match)setData(JSON.parse(match[0]))
      else setData({topics:[{name:"Main Topic",subtopics:["Key Point 1","Key Point 2","Key Point 3"]}]})
    }catch{alert("Upload PDF first!")}
    setBusy(false)
  }

  const colors=["#EA580C","#F43F5E","#FB923C","#10B981","#3B82F6"]

  return(
    <div>
      <div className="sec-title">🗺️ Concept Map</div>
      <div className="sec-sub">Visual mind map of your PDF content</div>
      <button className="btn btn-p" onClick={generate} disabled={busy} style={{marginBottom:16,width:"auto"}}>{busy?<><Spin/>Generating...</>:"🗺️ Generate Map"}</button>
      {data&&(
        <div className="card" style={{overflowX:"auto"}}>
          <div style={{minWidth:600,padding:16}}>
            {/* Center */}
            <div style={{textAlign:"center",marginBottom:32}}>
              <div style={{display:"inline-block",background:"var(--grad)",color:"white",padding:"10px 24px",borderRadius:100,fontWeight:700,fontSize:15,boxShadow:"0 4px 16px rgba(234,88,12,.3)"}}>
                📄 Your PDF
              </div>
            </div>
            {/* Topics */}
            <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(data.topics?.length||3,3)},1fr)`,gap:16}}>
              {(data.topics||[]).map((t,i)=>(
                <div key={i} style={{background:`${colors[i%5]}12`,border:`2px solid ${colors[i%5]}40`,borderRadius:16,padding:16,position:"relative"}}>
                  <div style={{fontWeight:700,fontSize:14,color:colors[i%5],marginBottom:10,textAlign:"center"}}>{t.name}</div>
                  {(t.subtopics||[]).map((s,j)=>(
                    <div key={j} style={{background:"var(--glass)",border:"1px solid var(--bg3)",borderRadius:8,padding:"6px 10px",marginBottom:6,fontSize:12,color:"var(--ink2)",display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:colors[i%5],flexShrink:0}}/>
                      {s}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ── PDF Summarizer ──
function SummaryBar({lang}){
  const [summary,setSummary]=useState("")
  const [busy,setBusy]=useState(false)
  const gen=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{question:"Summarize this entire document in exactly 2 sentences.",language:lang})
      setSummary(data.answer)
    }catch{}
    setBusy(false)
  }
  return(
    <div className="card" style={{marginBottom:16,background:"linear-gradient(135deg,rgba(234,88,12,.06),rgba(244,63,94,.03))"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--ink)"}}>⚡ Quick Summary</div>
        {!summary&&<button className="btn btn-p" onClick={gen} disabled={busy} style={{width:"auto",padding:"5px 14px",fontSize:12}}>{busy?<><Spin/>...</>:"Generate"}</button>}
        {summary&&<div style={{flex:1,fontSize:13,color:"var(--ink2)",lineHeight:1.5}}>{summary}</div>}
        {summary&&<button className="btn" onClick={()=>setSummary("")} style={{width:"auto",padding:"4px 10px",fontSize:11}}>✕</button>}
      </div>
    </div>
  )
}

// ── Bookmarks ──
function useBookmarks(){
  const [bms,setBms]=useState(()=>JSON.parse(localStorage.getItem("ml_bms")||"[]"))
  const add=item=>{const n=[item,...bms].slice(0,20);setBms(n);localStorage.setItem("ml_bms",JSON.stringify(n))}
  const remove=id=>{const n=bms.filter(b=>b.id!==id);setBms(n);localStorage.setItem("ml_bms",JSON.stringify(n))}
  return[bms,add,remove]
}

function BookmarksTab(){
  const [bms,,remove]=useBookmarks()
  return(
    <div>
      <div className="sec-title">🔖 Bookmarks</div>
      <div className="sec-sub">Your saved important answers</div>
      {!bms.length?<div className="card" style={{textAlign:"center",padding:32,color:"var(--ink2)",fontSize:14}}>No bookmarks yet! Click 🔖 on any answer to save it.</div>:
      bms.map(b=>(
        <div key={b.id} className="card" style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div>
              <div style={{fontSize:11,fontFamily:"DM Mono",color:"var(--ink3)",marginBottom:6}}>{b.date} · {b.type}</div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--ink)",marginBottom:6}}>{b.question}</div>
              <div style={{fontSize:13,color:"var(--ink2)",lineHeight:1.6}}>{b.answer.substring(0,200)}{b.answer.length>200?"...":""}</div>
            </div>
            <button className="btn" style={{width:"auto",padding:"4px 10px",fontSize:11,flexShrink:0}} onClick={()=>remove(b.id)}>🗑</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Study Plan Generator ──
function StudyPlanTab({lang}){
  const [subject,setSubject]=useState("")
  const [days,setDays]=useState(7)
  const [level,setLevel]=useState("Beginner")
  const [plan,setPlan]=useState("")
  const [busy,setBusy]=useState(false)

  const generate=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{
        question:`Create a detailed ${days}-day study plan for: ${subject}. Level: ${level}. 
Format as:
Day 1: [Topic] - [What to study] - [Time needed]
Day 2: ...etc
Include daily goals, resources tips and revision schedule.`,
        language:lang
      })
      setPlan(data.answer)
    }catch{alert("Error!")}
    setBusy(false)
  }

  return(
    <div>
      <div className="sec-title">📅 Study Plan Generator</div>
      <div className="sec-sub">AI-powered personalized study schedule</div>
      <div className="card">
        <input className="inp" placeholder="Subject or topic e.g. Machine Learning, Calculus..." value={subject} onChange={e=>setSubject(e.target.value)}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <label className="lbl">Days</label>
            <select className="sel" value={days} onChange={e=>setDays(Number(e.target.value))}>
              {[3,5,7,10,14,21,30].map(d=><option key={d}>{d} days</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Level</label>
            <select className="sel" value={level} onChange={e=>setLevel(e.target.value)}>
              {["Beginner","Intermediate","Advanced","Expert"].map(l=><option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-p" onClick={generate} disabled={busy||!subject} style={{width:"auto"}}>{busy?<><Spin/>Creating plan...</>:"📅 Generate Study Plan"}</button>
      </div>
      {plan&&(
        <div className="card" style={{whiteSpace:"pre-wrap",fontSize:14,lineHeight:1.8,marginTop:14}}>
          {plan}
          <div style={{marginTop:14,display:"flex",gap:10}}>
            <a href={"data:text/plain;charset=utf-8,"+(encodeURIComponent(plan))} download="study_plan.txt" style={{textDecoration:"none"}}>
              <button className="btn" style={{width:"auto"}}>⬇️ Download Plan</button>
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mock Interview Simulator ──
function MockInterviewTab({lang}){
  const [topic,setTopic]=useState("")
  const [role,setRole]=useState("Software Engineer")
  const [history,setHistory]=useState([])
  const [answer,setAnswer]=useState("")
  const [busy,setBusy]=useState(false)
  const [started,setStarted]=useState(false)
  const [feedback,setFeedback]=useState("")
  const endRef=useRef()

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[history])

  const start=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{
        question:`You are an interviewer for ${role} role. Start a mock interview about: ${topic||"general topics"}. Ask the first interview question. Be professional.`,
        language:lang
      })
      setHistory([{role:"interviewer",text:data.answer}])
      setStarted(true)
    }catch{alert("Error!")}
    setBusy(false)
  }

  const respond=async()=>{
    if(!answer.trim())return
    const ans=answer;setAnswer("")
    setHistory(h=>[...h,{role:"candidate",text:ans}])
    setBusy(true)
    try{
      const ctx=history.map(h=>h.role+": "+h.text).join("\n")
      const{data}=await axios.post(API+"/chat",{
        question:`Mock interview context:
${ctx}
Candidate: ${ans}

As the interviewer, either ask a follow-up question or next interview question. Keep it professional.`,
        language:lang
      })
      setHistory(h=>[...h,{role:"interviewer",text:data.answer}])
    }catch{alert("Error!")}
    setBusy(false)
  }

  const getFeedback=async()=>{
    setBusy(true)
    try{
      const ctx=history.map(h=>h.role+": "+h.text).join("\n")
      const{data}=await axios.post(API+"/chat",{
        question:`Review this mock interview and give detailed feedback on:
1. Answer quality
2. Communication
3. Areas to improve
4. Overall score /10

Interview:
${ctx}`,
        language:lang
      })
      setFeedback(data.answer)
    }catch{alert("Error!")}
    setBusy(false)
  }

  return(
    <div>
      <div className="sec-title">🎤 Mock Interview</div>
      <div className="sec-sub">Practice interviews with AI — get real feedback</div>
      {!started?(
        <div className="card">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label className="lbl">Role</label>
              <select className="sel" value={role} onChange={e=>setRole(e.target.value)}>
                {["Software Engineer","Data Scientist","Product Manager","Business Analyst","Frontend Developer","Backend Developer","ML Engineer","DevOps Engineer"].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Topic (optional)</label>
              <input className="inp" style={{marginBottom:0}} placeholder="e.g. React, System Design..." value={topic} onChange={e=>setTopic(e.target.value)}/>
            </div>
          </div>
          <button className="btn btn-p" onClick={start} disabled={busy} style={{width:"auto"}}>{busy?<><Spin/>Starting...</>:"🎤 Start Interview"}</button>
        </div>
      ):(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div className="chip">🎤 {role} Interview</div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-p" onClick={getFeedback} disabled={busy||history.length<4} style={{width:"auto",fontSize:12}}>📊 Get Feedback</button>
              <button className="btn" onClick={()=>{setStarted(false);setHistory([]);setFeedback("")}} style={{width:"auto",fontSize:12}}>↺ Restart</button>
            </div>
          </div>
          <div className="card" style={{maxHeight:400,overflowY:"auto",marginBottom:12}}>
            {history.map((h,i)=>(
              <div key={i} style={{
                padding:"12px 16px",borderRadius:14,marginBottom:8,fontSize:14,lineHeight:1.65,
                background:h.role==="interviewer"?"var(--bg2)":"rgba(234,88,12,.08)",
                border:`1px solid ${h.role==="interviewer"?"var(--bg3)":"rgba(234,88,12,.2)"}`,
                alignSelf:h.role==="candidate"?"flex-end":"flex-start"
              }}>
                <div style={{fontSize:10,fontFamily:"DM Mono",color:"var(--ink3)",marginBottom:4}}>
                  {h.role==="interviewer"?"🎙️ INTERVIEWER":"👤 YOU"}
                </div>
                {h.text}
              </div>
            ))}
            {busy&&<div style={{padding:"12px 16px",color:"var(--ink2)",fontSize:13}}><Spin/> Thinking...</div>}
            <div ref={endRef}/>
          </div>
          <div style={{display:"flex",gap:10}}>
            <input className="chat-in" value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==="Enter"&&respond()} placeholder="Type your answer..."/>
            <button className="btn btn-p" onClick={respond} disabled={busy||!answer.trim()}>Send</button>
          </div>
          {feedback&&(
            <div className="card" style={{marginTop:14,whiteSpace:"pre-wrap",fontSize:14,lineHeight:1.7,background:"linear-gradient(135deg,rgba(16,185,129,.06),rgba(234,88,12,.04))"}}>
              <div style={{fontWeight:700,color:"var(--green)",marginBottom:8}}>📊 Interview Feedback</div>
              {feedback}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Voice Input ──
function VoiceInput({onResult,lang="English"}){
  const [listening,setListening]=useState(false)
  const recRef=useRef()

  const toggle=()=>{
    if(listening){
      recRef.current?.stop()
      setListening(false)
    }else{
      const SpeechRec=window.SpeechRecognition||window.webkitSpeechRecognition
      if(!SpeechRec){alert("Voice not supported in this browser. Use Chrome!");return}
      const rec=new SpeechRec()
      const langMap={"English":"en-US","Hindi":"hi-IN","Hinglish":"hi-IN"}
      rec.lang=langMap[lang]||"en-US";rec.continuous=false;rec.interimResults=false
      rec.onresult=e=>{onResult(e.results[0][0].transcript);setListening(false)}
      rec.onerror=()=>setListening(false)
      rec.onend=()=>setListening(false)
      rec.start()
      recRef.current=rec
      setListening(true)
    }
  }

  return(
    <button className="btn" onClick={toggle} style={{width:"auto",padding:"10px 14px",fontSize:16,background:listening?"rgba(239,68,68,.1)":"var(--bg2)",color:listening?"var(--red)":"var(--v)",border:listening?"1px solid var(--red)":"1px solid rgba(234,88,12,.15)",animation:listening?"voicePulse 1s ease-in-out infinite":"none"}} title={listening?"Stop listening":"Start voice input"}>
      {listening?"🔴":"🎤"}
    </button>
  )
}

// ── AI Tutor Personality ──
const PERSONALITIES={
  Friendly:{icon:"😊",desc:"Warm and encouraging",prompt:"Be friendly, warm and encouraging. Use simple language and positive reinforcement."},
  Strict:{icon:"📐",desc:"Formal and precise",prompt:"Be strict, formal and precise. Give concise, accurate answers without fluff."},
  Funny:{icon:"😄",desc:"Humorous and fun",prompt:"Be funny and entertaining while being helpful. Use humor, puns and fun analogies."},
  Socratic:{icon:"🤔",desc:"Ask guiding questions",prompt:"Use the Socratic method. Guide with questions instead of direct answers."},
  ELI5:{icon:"🧒",desc:"Super simple",prompt:"Explain everything very simply, like to a child. Use analogies and simple words."},
}


// ── Drag & Drop Upload ──
function DragDropUpload({onUp,busy}){
  const [drag,setDrag]=useState(false)
  const [files,setFiles]=useState([])
  const ref=useRef()

  const handleDrop=e=>{
    e.preventDefault();setDrag(false)
    const dropped=[...e.dataTransfer.files].filter(f=>f.name.endsWith(".pdf"))
    if(dropped.length)setFiles(dropped)
  }

  return(
    <div
      onDragOver={e=>{e.preventDefault();setDrag(true)}}
      onDragLeave={()=>setDrag(false)}
      onDrop={handleDrop}
      style={{
        background:drag?"rgba(255,255,255,.28)":"rgba(255,255,255,.13)",
        backdropFilter:"blur(16px)",
        border:drag?"2px solid rgba(255,255,255,.7)":"1.5px solid rgba(255,255,255,.28)",
        borderRadius:24,padding:"28px 32px",maxWidth:460,width:"100%",
        margin:"0 auto 40px",transition:"all .2s",
        boxShadow:drag?"0 12px 40px rgba(0,0,0,.2)":"0 8px 32px rgba(0,0,0,.12)",
        transform:drag?"scale(1.02)":"scale(1)"
      }}
    >
      <input ref={ref} type="file" accept=".pdf" multiple style={{display:"none"}} onChange={e=>setFiles([...e.target.files])}/>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:drag?52:40,marginBottom:12,transition:"font-size .2s"}}>{drag?"📂":"📄"}</div>
        <p style={{color:"rgba(255,255,255,.8)",fontSize:14,marginBottom:14,fontWeight:500}}>
          {drag?"Drop your PDFs here!":"Drag & drop PDFs or click to browse"}
        </p>
        {files.length>0&&(
          <div style={{background:"rgba(0,0,0,.15)",borderRadius:10,padding:"8px 12px",marginBottom:12,fontSize:12,color:"rgba(255,255,255,.85)",fontFamily:"DM Mono,monospace"}}>
            {files.map(f=>f.name).join(", ")}
          </div>
        )}
        <button className="upload-btn-ghost" onClick={()=>ref.current.click()} style={{marginBottom:files.length?10:0}}>
          📁 Browse Files
        </button>
        {files.length>0&&(
          <button className="upload-btn-white" disabled={busy} onClick={()=>{const fd=new FormData();files.forEach(f=>fd.append("files",f));onUp(fd)}}>
            {busy?<><Spin/>Processing...</>:"⚡ Process & Start Learning"}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Copy Button ──
function CopyBtn({text}){
  const [copied,setCopied]=useState(false)
  const copy=()=>{
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(()=>setCopied(false),2000)
  }
  return(
    <button onClick={copy} style={{background:"none",border:"1px solid rgba(234,88,12,.2)",borderRadius:8,padding:"3px 8px",fontSize:11,color:copied?"var(--green)":"var(--ink3)",cursor:"pointer",transition:"all .2s",fontFamily:"DM Mono,monospace"}}>
      {copied?"✅ Copied":"📋 Copy"}
    </button>
  )
}

// ── Confetti ──
function Confetti(){
  const colors=["#EA580C","#F43F5E","#FB923C","#10B981","#3B82F6","#F59E0B"]
  const pieces=Array.from({length:60},(_,i)=>({
    id:i,
    color:colors[i%colors.length],
    left:Math.random()*100,
    delay:Math.random()*2,
    duration:2+Math.random()*2,
    size:6+Math.random()*8
  }))
  return(
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
      {pieces.map(p=>(
        <div key={p.id} style={{
          position:"absolute",left:`${p.left}%`,top:"-20px",
          width:p.size,height:p.size,
          background:p.color,borderRadius:Math.random()>.5?"50%":"2px",
          animation:`confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
          transform:`rotate(${Math.random()*360}deg)`
        }}/>
      ))}
      <style>{"@keyframes confettiFall{to{transform:translateY(110vh) rotate(720deg);opacity:0}}"}</style>
    </div>
  )
}

// ── Notification Bell ──
function NotificationBell({notifications,onClear}){
  const [open,setOpen]=useState(false)
  const unread=notifications.filter(n=>!n.read).length
  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,padding:"4px 8px",position:"relative",borderRadius:8,transition:"background .2s"}} title="Notifications">
        🔔
        {unread>0&&<span style={{position:"absolute",top:0,right:0,background:"var(--red)",color:"white",borderRadius:"50%",width:16,height:16,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{unread}</span>}
      </button>
      {open&&(
        <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",background:"var(--white)",border:"1px solid rgba(234,88,12,.15)",borderRadius:16,boxShadow:"var(--s2)",width:280,zIndex:200,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(234,88,12,.08)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:700,color:"var(--ink)"}}>🔔 Notifications</span>
            <button onClick={onClear} style={{fontSize:11,color:"var(--ink3)",background:"none",border:"none",cursor:"pointer"}}>Clear all</button>
          </div>
          {notifications.length===0?(
            <div style={{padding:"20px 16px",textAlign:"center",color:"var(--ink2)",fontSize:13}}>No notifications</div>
          ):notifications.map((n,i)=>(
            <div key={i} style={{padding:"10px 16px",borderBottom:"1px solid rgba(234,88,12,.06)",background:n.read?"transparent":"rgba(234,88,12,.04)"}}>
              <div style={{fontSize:13,color:"var(--ink)",marginBottom:2}}>{n.text}</div>
              <div style={{fontSize:11,color:"var(--ink3)",fontFamily:"DM Mono,monospace"}}>{n.time}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Search Chat ──
function SearchChat({msgs,onSelect}){
  const [q,setQ]=useState("")
  const [open,setOpen]=useState(false)
  const results=q.trim()?msgs.filter(m=>m.t.toLowerCase().includes(q.toLowerCase())).slice(0,5):[]
  return(
    <div style={{position:"relative",flex:1}}>
      <input
        className="chat-in"
        placeholder="🔍 Search chat history..."
        value={q}
        onChange={e=>{setQ(e.target.value);setOpen(true)}}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false),200)}
        style={{fontSize:12}}
      />
      {open&&results.length>0&&(
        <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,right:0,background:"var(--white)",border:"1px solid rgba(234,88,12,.15)",borderRadius:12,boxShadow:"var(--s2)",zIndex:100,overflow:"hidden"}}>
          {results.map((m,i)=>(
            <div key={i} onClick={()=>{onSelect(m.t);setQ("");setOpen(false)}} style={{padding:"10px 14px",cursor:"pointer",fontSize:13,color:"var(--ink)",borderBottom:"1px solid rgba(234,88,12,.06)",transition:"background .15s"}}
              onMouseEnter={e=>e.target.style.background="var(--bg2)"}
              onMouseLeave={e=>e.target.style.background="transparent"}>
              <span style={{color:"var(--ink3)",fontSize:11,fontFamily:"DM Mono,monospace"}}>{m.r==="user"?"👤":"🤖"}</span> {m.t.substring(0,60)}...
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── Multi Theme Color Picker ──
const THEMES = {
  "Sunset Orange": {"--v":"#EA580C","--v2":"#C2410C","--bg":"#FFF9F5","--bg2":"#FFF0E6","--bg3":"#FFE0CC","--grad":"linear-gradient(135deg,#EA580C,#F43F5E)"},
  "Ocean Blue":    {"--v":"#2563EB","--v2":"#1D4ED8","--bg":"#F0F7FF","--bg2":"#DBEAFE","--bg3":"#BFDBFE","--grad":"linear-gradient(135deg,#2563EB,#7C3AED)"},
  "Emerald":       {"--v":"#059669","--v2":"#047857","--bg":"#F0FDF4","--bg2":"#DCFCE7","--bg3":"#BBF7D0","--grad":"linear-gradient(135deg,#059669,#0891B2)"},
  "Rose Pink":     {"--v":"#E11D48","--v2":"#BE123C","--bg":"#FFF1F2","--bg2":"#FFE4E6","--bg3":"#FECDD3","--grad":"linear-gradient(135deg,#E11D48,#9333EA)"},
  "Purple":        {"--v":"#7C3AED","--v2":"#6D28D9","--bg":"#F5F3FF","--bg2":"#EDE9FE","--bg3":"#DDD6FE","--grad":"linear-gradient(135deg,#7C3AED,#EC4899)"},
}

function ThemePicker(){
  const [active,setActive]=useState(()=>localStorage.getItem("ml_theme")||"Sunset Orange")
  const apply=name=>{
    setActive(name)
    localStorage.setItem("ml_theme",name)
    const t=THEMES[name]
    Object.entries(t).forEach(([k,v])=>document.documentElement.style.setProperty(k,v))
  }
  useEffect(()=>{apply(active)},[])
  return(
    <div>
      <div className="sec-title">🎨 Theme Picker</div>
      <div className="sec-sub">Customize your MindLearn color theme</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginTop:8}}>
        {Object.entries(THEMES).map(([name,t])=>(
          <div key={name} onClick={()=>apply(name)} style={{
            background:`linear-gradient(135deg,${t["--v"]},${t["--v2"]})`,
            borderRadius:16,padding:"20px 16px",cursor:"pointer",
            border:active===name?"3px solid var(--ink)":"3px solid transparent",
            transform:active===name?"scale(1.04)":"scale(1)",
            transition:"all .2s",boxShadow:active===name?"0 8px 24px rgba(0,0,0,.2)":"var(--s1)"
          }}>
            <div style={{fontSize:24,marginBottom:8}}>
              {name==="Sunset Orange"?"🌅":name==="Ocean Blue"?"🌊":name==="Emerald"?"🌿":name==="Rose Pink"?"🌸":"💜"}
            </div>
            <div style={{fontSize:14,fontWeight:700,color:"white",letterSpacing:"-.02em"}}>{name}</div>
            {active===name&&<div style={{fontSize:11,color:"rgba(255,255,255,.8)",marginTop:4}}>✓ Active</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Leaderboard ──
function LeaderboardTab(){
  const [scores,setScores]=useState(()=>JSON.parse(localStorage.getItem("ml_scores")||"[]"))
  const [name,setName]=useState(()=>localStorage.getItem("ml_username")||"")
  const [editing,setEditing]=useState(!localStorage.getItem("ml_username"))

  const saveName=()=>{
    localStorage.setItem("ml_username",name)
    setEditing(false)
  }

  // Get current session stats
  const myScore={
    name:name||"You",
    quizzes:scores.filter(s=>s.name===name).length,
    avgScore:scores.filter(s=>s.name===name).length?
      Math.round(scores.filter(s=>s.name===name).reduce((a,b)=>a+b.pct,0)/scores.filter(s=>s.name===name).length):0,
    best:scores.filter(s=>s.name===name).length?
      Math.max(...scores.filter(s=>s.name===name).map(s=>s.pct)):0,
    date:new Date().toLocaleDateString()
  }

  const all=[...new Map(scores.map(s=>[s.name,{
    name:s.name,
    avgScore:Math.round(scores.filter(x=>x.name===s.name).reduce((a,b)=>a+b.pct,0)/scores.filter(x=>x.name===s.name).length),
    quizzes:scores.filter(x=>x.name===s.name).length,
    best:Math.max(...scores.filter(x=>x.name===s.name).map(x=>x.pct))
  }])).values()].sort((a,b)=>b.avgScore-a.avgScore)

  const medals=["🥇","🥈","🥉"]

  return(
    <div>
      <div className="sec-title">🏆 Leaderboard</div>
      <div className="sec-sub">Track your quiz scores and compete!</div>

      {editing?(
        <div className="card" style={{marginBottom:16}}>
          <label className="lbl">Your Name</label>
          <div style={{display:"flex",gap:10}}>
            <input className="inp" style={{marginBottom:0}} placeholder="Enter your name..." value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveName()}/>
            <button className="btn btn-p" onClick={saveName} style={{width:"auto"}}>Save</button>
          </div>
        </div>
      ):(
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:14,fontWeight:600,color:"var(--ink)"}}>👤 Playing as: <b>{name}</b></span>
          <button className="btn" style={{width:"auto",fontSize:12,padding:"5px 12px"}} onClick={()=>setEditing(true)}>✏️ Change Name</button>
        </div>
      )}

      {/* My Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {[["🧪",myScore.quizzes,"Quizzes"],["📊",myScore.avgScore+"%","Avg Score"],["⭐",myScore.best+"%","Best Score"]].map(([ic,v,l])=>(
          <div key={l} className="card" style={{textAlign:"center",padding:16}}>
            <div style={{fontSize:24,marginBottom:6}}>{ic}</div>
            <div style={{fontSize:"1.6rem",fontWeight:800,color:"var(--v)",letterSpacing:"-.04em"}}>{v}</div>
            <div style={{fontSize:12,color:"var(--ink2)"}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Leaderboard Table */}
      {all.length>0?(
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(234,88,12,.08)",fontWeight:700,fontSize:13,color:"var(--ink)"}}>
            📋 All Players
          </div>
          {all.map((p,i)=>(
            <div key={p.name} style={{
              display:"flex",alignItems:"center",gap:12,padding:"12px 20px",
              borderBottom:"1px solid rgba(234,88,12,.06)",
              background:p.name===name?"rgba(234,88,12,.04)":"transparent"
            }}>
              <div style={{fontSize:20,width:28}}>{medals[i]||`${i+1}`}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--ink)"}}>{p.name} {p.name===name&&"(You)"}</div>
                <div style={{fontSize:11,color:"var(--ink3)",fontFamily:"DM Mono,monospace"}}>{p.quizzes} quizzes</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:16,fontWeight:800,color:"var(--v)"}}>{p.avgScore}%</div>
                <div style={{fontSize:11,color:"var(--ink3)"}}>avg</div>
              </div>
            </div>
          ))}
        </div>
      ):<div className="card" style={{textAlign:"center",padding:32,color:"var(--ink2)"}}>Complete a quiz to appear on the leaderboard!</div>}
    </div>
  )
}

// ── Custom AI System Prompt ──
function CustomPromptTab(){
  const [prompt,setPrompt]=useState(()=>localStorage.getItem("ml_sysprompt")||"")
  const [saved,setSaved]=useState(false)
  const presets=[
    {name:"Strict Teacher",prompt:"Be a strict teacher. Give precise, concise answers. No fluff. Use technical terms."},
    {name:"Friendly Tutor",prompt:"Be a warm, encouraging tutor. Use simple language and positive reinforcement."},
    {name:"Socratic",prompt:"Use the Socratic method. Guide with questions instead of direct answers."},
    {name:"Exam Prep",prompt:"Focus on exam-relevant content. Highlight key points, definitions, and likely exam questions."},
    {name:"Research Mode",prompt:"Provide deep, comprehensive answers with examples, context, and connections to other topics."},
  ]
  const save=()=>{
    localStorage.setItem("ml_sysprompt",prompt)
    setSaved(true)
    setTimeout(()=>setSaved(false),2000)
  }
  return(
    <div>
      <div className="sec-title">⚙️ Custom AI Prompt</div>
      <div className="sec-sub">Customize how your AI tutor behaves</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8,marginBottom:16}}>
        {presets.map(p=>(
          <button key={p.name} className="btn" style={{width:"auto",fontSize:12,textAlign:"left",padding:"8px 12px"}} onClick={()=>setPrompt(p.prompt)}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="card">
        <label className="lbl">System Prompt</label>
        <textarea className="inp" style={{height:140,resize:"vertical",fontFamily:"DM Mono,monospace",fontSize:12,marginBottom:12}} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Enter custom instructions for AI tutor..."/>
        <div style={{display:"flex",gap:10}}>
          <button className="btn btn-p" onClick={save} style={{width:"auto"}}>{saved?"✅ Saved!":"💾 Save Prompt"}</button>
          <button className="btn" onClick={()=>{setPrompt("");localStorage.removeItem("ml_sysprompt")}} style={{width:"auto"}}>🗑 Reset</button>
        </div>
      </div>
      {prompt&&<div className="card" style={{marginTop:12,background:"rgba(234,88,12,.04)"}}>
        <div style={{fontSize:11,fontFamily:"DM Mono,monospace",color:"var(--ink3)",marginBottom:6}}>ACTIVE PROMPT</div>
        <div style={{fontSize:13,color:"var(--ink2)",lineHeight:1.6}}>{prompt}</div>
      </div>}
    </div>
  )
}

// ── Typing Speed Test ──
const TYPING_TEXTS=[
  "Artificial intelligence is the simulation of human intelligence processes by computer systems.",
  "Machine learning enables computers to learn from data without being explicitly programmed.",
  "Neural networks are computing systems inspired by biological neural networks in animal brains.",
  "Deep learning uses multiple layers of neural networks to progressively extract higher level features.",
  "Natural language processing is a branch of AI that helps computers understand human language.",
]

function TypingTestTab(){
  const [text]=useState(()=>TYPING_TEXTS[Math.floor(Math.random()*TYPING_TEXTS.length)])
  const [typed,setTyped]=useState("")
  const [started,setStarted]=useState(false)
  const [done,setDone]=useState(false)
  const [startTime,setStartTime]=useState(null)
  const [elapsed,setElapsed]=useState(0)
  const [wpm,setWpm]=useState(0)
  const [acc,setAcc]=useState(0)
  const ref=useRef()
  const timerRef=useRef()

  useEffect(()=>{
    if(started&&!done){
      timerRef.current=setInterval(()=>setElapsed(e=>e+1),1000)
    }
    return()=>clearInterval(timerRef.current)
  },[started,done])

  const handleType=e=>{
    const val=e.target.value
    if(!started){setStarted(true);setStartTime(Date.now())}
    setTyped(val)
    if(val===text){
      clearInterval(timerRef.current)
      const mins=(Date.now()-startTime)/60000
      const words=text.split(" ").length
      setWpm(Math.round(words/mins))
      const correct=val.split("").filter((c,i)=>c===text[i]).length
      setAcc(Math.round((correct/text.length)*100))
      setDone(true)
    }
  }

  const reset=()=>{setTyped("");setStarted(false);setDone(false);setElapsed(0);setWpm(0);setAcc(0)}

  const getCharClass=i=>{
    if(i>=typed.length)return{color:"var(--ink2)"}
    return typed[i]===text[i]?{color:"var(--green)",fontWeight:600}:{color:"var(--red)",background:"rgba(239,68,68,.1)",borderRadius:2}
  }

  return(
    <div>
      <div className="sec-title">⌨️ Typing Speed Test</div>
      <div className="sec-sub">Test your typing speed — WPM & accuracy</div>
      {!done?(
        <>
          <div style={{display:"flex",gap:16,marginBottom:12}}>
            <div className="card" style={{flex:1,textAlign:"center",padding:12}}>
              <div style={{fontSize:"1.4rem",fontWeight:800,color:"var(--v)"}}>{elapsed}s</div>
              <div style={{fontSize:11,color:"var(--ink2)"}}>Time</div>
            </div>
            <div className="card" style={{flex:1,textAlign:"center",padding:12}}>
              <div style={{fontSize:"1.4rem",fontWeight:800,color:"var(--v)"}}>
                {typed.length?Math.round((typed.split(" ").length/Math.max(elapsed/60,0.01))):0}
              </div>
              <div style={{fontSize:11,color:"var(--ink2)"}}>WPM</div>
            </div>
            <div className="card" style={{flex:1,textAlign:"center",padding:12}}>
              <div style={{fontSize:"1.4rem",fontWeight:800,color:"var(--v)"}}>
                {typed.length?Math.round((typed.split("").filter((c,i)=>c===text[i]).length/typed.length)*100):100}%
              </div>
              <div style={{fontSize:11,color:"var(--ink2)"}}>Accuracy</div>
            </div>
          </div>
          <div className="card" style={{fontFamily:"DM Mono,monospace",fontSize:16,lineHeight:2,letterSpacing:".02em",marginBottom:12}}>
            {text.split("").map((c,i)=>(
              <span key={i} style={getCharClass(i)}>{c}</span>
            ))}
            {typed.length<text.length&&<span style={{borderLeft:"2px solid var(--v)",animation:"voicePulse 1s ease-in-out infinite"}}/>}
          </div>
          <textarea ref={ref} className="inp" style={{fontFamily:"DM Mono,monospace",fontSize:14,height:80}} value={typed} onChange={handleType} placeholder="Start typing here..." autoFocus/>
        </>
      ):(
        <div className="card" style={{textAlign:"center",padding:40}}>
          <div style={{fontSize:"3rem",marginBottom:8}}>🎉</div>
          <div style={{display:"flex",gap:20,justifyContent:"center",marginBottom:20}}>
            <div><div style={{fontSize:"2.5rem",fontWeight:800,color:"var(--v)",letterSpacing:"-.05em"}}>{wpm}</div><div style={{color:"var(--ink2)"}}>WPM</div></div>
            <div><div style={{fontSize:"2.5rem",fontWeight:800,color:"var(--green)",letterSpacing:"-.05em"}}>{acc}%</div><div style={{color:"var(--ink2)"}}>Accuracy</div></div>
            <div><div style={{fontSize:"2.5rem",fontWeight:800,color:"var(--amber)",letterSpacing:"-.05em"}}>{elapsed}s</div><div style={{color:"var(--ink2)"}}>Time</div></div>
          </div>
          <div style={{fontSize:14,color:"var(--ink2)",marginBottom:16}}>
            {wpm>=60?"🔥 Excellent! You're a fast typist!":wpm>=40?"👍 Good speed! Keep practicing!":"💪 Keep practicing to improve!"}
          </div>
          <button className="btn btn-p" onClick={reset} style={{width:"auto"}}>🔄 Try Again</button>
        </div>
      )}
    </div>
  )
}

// ── PDF Thumbnail Preview ──
function PDFPreviewCard({files}){
  if(!files||!files.length)return null
  return(
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
      {files.map((f,i)=>(
        <div key={i} className="card" style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:10,minWidth:200,flex:1}}>
          <div style={{width:40,height:48,background:"linear-gradient(135deg,var(--v),var(--pink))",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>📄</div>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"var(--ink)",marginBottom:2,wordBreak:"break-all"}}>{f}</div>
            <div style={{fontSize:11,color:"var(--green)",fontFamily:"DM Mono,monospace"}}>✅ Processed</div>
          </div>
        </div>
      ))}
    </div>
  )
}


// ── Daily Motivation ──
const QUOTES = [
  {q:"The secret of getting ahead is getting started.",a:"Mark Twain"},
  {q:"It always seems impossible until it's done.",a:"Nelson Mandela"},
  {q:"Don't watch the clock; do what it does. Keep going.",a:"Sam Levenson"},
  {q:"Success is the sum of small efforts repeated day in and day out.",a:"Robert Collier"},
  {q:"The expert in anything was once a beginner.",a:"Helen Hayes"},
  {q:"Push yourself, because no one else is going to do it for you.",a:"Unknown"},
  {q:"Great things never come from comfort zones.",a:"Unknown"},
  {q:"Dream it. Wish it. Do it.",a:"Unknown"},
  {q:"Stay focused and never give up.",a:"Unknown"},
  {q:"The harder you work for something, the greater you'll feel when you achieve it.",a:"Unknown"},
]

function MotivationCard(){
  const today = new Date().getDay()
  const q = QUOTES[today % QUOTES.length]
  const [liked,setLiked] = useState(false)
  return(
    <div className="card" style={{background:"linear-gradient(135deg,rgba(234,88,12,.06),rgba(244,63,94,.04))",marginBottom:16,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-20,right:-20,fontSize:80,opacity:.05}}>💡</div>
      <div style={{fontSize:11,fontFamily:"DM Mono,monospace",color:"var(--v)",marginBottom:10,letterSpacing:".1em"}}>✨ DAILY MOTIVATION</div>
      <div style={{fontSize:16,fontWeight:600,color:"var(--ink)",lineHeight:1.6,marginBottom:8,fontStyle:"italic"}}>"{q.q}"</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:12,color:"var(--ink3)"}}>— {q.a}</div>
        <button onClick={()=>setLiked(l=>!l)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18}}>{liked?"❤️":"🤍"}</button>
      </div>
    </div>
  )
}

// ── PDF Info Card ──
function PDFInfoCard({info}){
  if(!info.files)return null
  return(
    <div className="card" style={{marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:"var(--ink)",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
        📊 PDF Session Info
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {[
          ["📄",info.files,"PDFs"],
          ["🧩",info.chunks,"Chunks"],
          ["💾",`${Math.round(info.chunks*0.6)}KB`,"Est. Size"],
        ].map(([ic,v,l])=>(
          <div key={l} style={{textAlign:"center",background:"var(--bg2)",borderRadius:10,padding:"10px 8px"}}>
            <div style={{fontSize:18}}>{ic}</div>
            <div style={{fontSize:"1.2rem",fontWeight:800,color:"var(--v)",letterSpacing:"-.03em"}}>{v}</div>
            <div style={{fontSize:11,color:"var(--ink2)"}}>{l}</div>
          </div>
        ))}
      </div>
      {info.fileNames&&info.fileNames.length>0&&(
        <div style={{marginTop:12}}>
          {info.fileNames.map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid rgba(234,88,12,.06)"}}>
              <span style={{fontSize:14}}>📄</span>
              <span style={{fontSize:12,color:"var(--ink2)",fontFamily:"DM Mono,monospace"}}>{f}</span>
              <span style={{marginLeft:"auto",fontSize:11,color:"var(--green)",background:"rgba(16,185,129,.1)",padding:"2px 8px",borderRadius:100}}>✅ Ready</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Chat Export ──
function exportChatToPDF(msgs){
  const w=window.open("","_blank")
  const html=msgs.map(m=>`
    <div style="margin-bottom:16px;padding:12px 16px;border-radius:12px;
      background:${m.r==="user"?"#EA580C":"#f5f5f5"};
      color:${m.r==="user"?"white":"#1A0A00"};
      max-width:80%;margin-left:${m.r==="user"?"auto":"0"}">
      <div style="font-size:10px;opacity:.7;margin-bottom:4px">${m.r==="user"?"You":"AI Tutor"}</div>
      <div style="font-size:14px;line-height:1.6">${m.t}</div>
    </div>
  `).join("")
  w.document.write(`<html><head><title>MindLearn Chat Export</title>
    <style>body{font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto}
    h1{color:#EA580C}hr{border-color:#eee}</style></head>
    <body><h1>🧠 MindLearn AI — Chat Export</h1>
    <p style="color:#888;font-size:12px">${new Date().toLocaleString()} · ${msgs.length} messages</p>
    <hr/>${html}<hr/>
    <p style="color:#888;font-size:11px">Generated by MindLearn AI</p>
    </body></html>`)
  w.document.close()
  w.print()
}

// ── Mnemonics Generator ──
function MnemonicsTab({lang}){
  const [topic,setTopic]=useState("")
  const [result,setResult]=useState("")
  const [busy,setBusy]=useState(false)

  const generate=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{
        question:`Create 5 creative mnemonics, memory tricks, and acronyms to remember key concepts about: "${topic}". Make them fun, catchy and easy to remember. Format each with a title and explanation.`,
        language:lang
      })
      setResult(data.answer)
    }catch{alert("Upload PDF or try again!")}
    setBusy(false)
  }
  return(
    <div>
      <div className="sec-title">🧠 Mnemonics Generator</div>
      <div className="sec-sub">AI creates memory tricks to help you remember anything</div>
      <div className="card">
        <input className="inp" placeholder="e.g. Planets of solar system, Types of memory, OSI layers..." value={topic} onChange={e=>setTopic(e.target.value)}/>
        <button className="btn btn-p" onClick={generate} disabled={busy||!topic} style={{width:"auto"}}>{busy?<><Spin/>Creating...</>:"🧠 Generate Mnemonics"}</button>
      </div>
      {result&&<div className="card" style={{whiteSpace:"pre-wrap",fontSize:14,lineHeight:1.8,marginTop:14}}>{result}</div>}
    </div>
  )
}

// ── Subject Difficulty Rating ──
function DifficultyRater(){
  const [ratings,setRatings]=useState(()=>JSON.parse(localStorage.getItem("ml_ratings")||"{}"))
  const [topic,setTopic]=useState("")
  const [rating,setRating]=useState(3)

  const save=()=>{
    if(!topic.trim())return
    const n={...ratings,[topic]:{rating,date:new Date().toLocaleDateString()}}
    setRatings(n)
    localStorage.setItem("ml_ratings",JSON.stringify(n))
    setTopic("")
  }

  const stars=n=>Array.from({length:5},(_,i)=>(
    <span key={i} onClick={()=>setRating(i+1)} style={{cursor:"pointer",fontSize:20,color:i<rating?"#F59E0B":"var(--bg3)",transition:"color .15s"}}>★</span>
  ))

  const diffLabel=r=>r<=2?"Easy 😊":r===3?"Medium 🤔":r<=4?"Hard 😓":"Very Hard 🔥"
  const diffColor=r=>r<=2?"var(--green)":r===3?"var(--amber)":r<=4?"var(--v)":"var(--red)"

  return(
    <div>
      <div className="sec-title">📊 Difficulty Rater</div>
      <div className="sec-sub">Rate topics by difficulty to track what needs more study</div>
      <div className="card" style={{marginBottom:16}}>
        <input className="inp" placeholder="Topic name e.g. Calculus, Thermodynamics..." value={topic} onChange={e=>setTopic(e.target.value)}/>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12}}>
          <div>{stars(5)}</div>
          <span style={{fontSize:13,fontWeight:600,color:diffColor(rating)}}>{diffLabel(rating)}</span>
        </div>
        <button className="btn btn-p" onClick={save} disabled={!topic.trim()} style={{width:"auto"}}>💾 Save Rating</button>
      </div>
      {Object.keys(ratings).length>0&&(
        <div className="card">
          <div style={{fontSize:13,fontWeight:700,color:"var(--ink)",marginBottom:12}}>📋 Your Topic Ratings</div>
          {Object.entries(ratings).sort((a,b)=>b[1].rating-a[1].rating).map(([t,r])=>(
            <div key={t} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid rgba(234,88,12,.06)"}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"var(--ink)"}}>{t}</div>
                <div style={{fontSize:11,color:"var(--ink3)"}}>{r.date}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:"#F59E0B",fontSize:14}}>{"★".repeat(r.rating)}</span>
                <span style={{fontSize:11,color:diffColor(r.rating),fontWeight:600}}>{diffLabel(r.rating)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Spaced Repetition ──
function SpacedRepetitionTab({lang}){
  const [cards,setCards]=useState(()=>JSON.parse(localStorage.getItem("ml_srs")||"[]"))
  const [current,setCurrent]=useState(0)
  const [show,setShow]=useState(false)
  const [busy,setBusy]=useState(false)

  const load=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/flashcards",{language:lang})
      const srsCards=data.flashcards.map(c=>({...c,due:new Date().toISOString(),interval:1,ease:2.5,reps:0}))
      setCards(srsCards)
      localStorage.setItem("ml_srs",JSON.stringify(srsCards))
      setCurrent(0);setShow(false)
    }catch{alert("Upload PDF first!")}
    setBusy(false)
  }

  const rate=r=>{
    const updated=[...cards]
    const c=updated[current]
    if(r>=3){c.interval=Math.round(c.interval*c.ease);c.ease=Math.min(2.5,c.ease+0.1)}
    else{c.interval=1;c.ease=Math.max(1.3,c.ease-0.2)}
    c.reps+=1
    c.due=new Date(Date.now()+c.interval*86400000).toISOString()
    localStorage.setItem("ml_srs",JSON.stringify(updated))
    setCards(updated)
    setShow(false)
    if(current+1<cards.length)setCurrent(i=>i+1)
    else setCurrent(0)
  }

  const due=cards.filter(c=>new Date(c.due)<=new Date())

  return(
    <div>
      <div className="sec-title">🔁 Spaced Repetition</div>
      <div className="sec-sub">Smart flashcard system — review at optimal intervals</div>
      {!cards.length?(
        <button className="btn btn-p" onClick={load} disabled={busy} style={{width:"auto"}}>{busy?<><Spin/>Loading...</>:"📥 Load Cards"}</button>
      ):(
        <>
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
            <span className="chip">📚 {cards.length} total cards</span>
            <span className="chip" style={{background:due.length?"rgba(234,88,12,.1)":"rgba(16,185,129,.1)",color:due.length?"var(--v)":"var(--green)"}}>
              {due.length>0?`⏰ ${due.length} due today`:"✅ All caught up!"}
            </span>
          </div>
          {due.length>0?(
            <>
              <div className="fc" key={current}>
                <div className="fc-lbl">{show?"ANSWER":"TERM"} · Card {current+1}/{cards.length}</div>
                <div className="fc-term">{cards[current]?.term}</div>
                {show&&<div className="fc-def">{cards[current]?.definition}</div>}
              </div>
              {!show?(
                <button className="btn btn-p" onClick={()=>setShow(true)} style={{marginTop:14,width:"auto"}}>Show Answer</button>
              ):(
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:14}}>
                  {[["😓","Again",1],["🤔","Hard",2],["😊","Good",3],["🔥","Easy",4]].map(([em,lb,v])=>(
                    <button key={lb} className="btn" style={{fontSize:12,padding:"8px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:2}} onClick={()=>rate(v)}>
                      <span style={{fontSize:20}}>{em}</span>{lb}
                    </button>
                  ))}
                </div>
              )}
            </>
          ):<div className="card" style={{textAlign:"center",padding:32,color:"var(--ink2)"}}>🎉 All cards reviewed! Come back tomorrow.</div>}
        </>
      )}
    </div>
  )
}

// ── AI Debate With Yourself ──
function SelfDebateTab({lang}){
  const [topic,setTopic]=useState("")
  const [debate,setDebate]=useState(null)
  const [busy,setBusy]=useState(false)

  const generate=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{
        question:`Generate a structured debate on: "${topic}"
Present BOTH sides clearly:
## FOR (Arguments in favor)
- Point 1
- Point 2  
- Point 3

## AGAINST (Arguments opposed)
- Point 1
- Point 2
- Point 3

## VERDICT
A balanced conclusion.

Language: ${lang}`,
        language:lang
      })
      setDebate(data.answer)
    }catch{alert("Error!")}
    setBusy(false)
  }

  return(
    <div>
      <div className="sec-title">⚖️ Debate Yourself</div>
      <div className="sec-sub">See both sides of any argument — build critical thinking</div>
      <div className="card">
        <input className="inp" placeholder="e.g. Is AI beneficial for society? Should exams be abolished?" value={topic} onChange={e=>setTopic(e.target.value)}/>
        <button className="btn btn-p" onClick={generate} disabled={busy||!topic} style={{width:"auto"}}>{busy?<><Spin/>Thinking...</>:"⚖️ Generate Both Sides"}</button>
      </div>
      {debate&&<div className="card" style={{whiteSpace:"pre-wrap",fontSize:14,lineHeight:1.8,marginTop:14}}>{debate}</div>}
    </div>
  )
}

// ── Reading Speed Tracker ──
function ReadingTrackerTab(){
  const [text,setText]=useState("")
  const [started,setStarted]=useState(false)
  const [done,setDone]=useState(false)
  const [startTime,setStartTime]=useState(null)
  const [wpm,setWpm]=useState(0)
  const [history,setHistory]=useState(()=>JSON.parse(localStorage.getItem("ml_reading")||"[]"))

  const start=()=>{setStarted(true);setStartTime(Date.now())}
  const finish=()=>{
    const mins=(Date.now()-startTime)/60000
    const words=text.trim().split(/\s+/).length
    const speed=Math.round(words/mins)
    setWpm(speed)
    setDone(true)
    const h=[{wpm:speed,words,date:new Date().toLocaleDateString()},...history].slice(0,10)
    setHistory(h)
    localStorage.setItem("ml_reading",JSON.stringify(h))
  }
  const reset=()=>{setStarted(false);setDone(false);setText("");setWpm(0)}

  return(
    <div>
      <div className="sec-title">📖 Reading Speed Tracker</div>
      <div className="sec-sub">Measure your reading speed in words per minute</div>
      {!done?(
        <div className="card">
          <textarea className="inp" style={{height:160,resize:"vertical"}} placeholder="Paste any text here to measure your reading speed..." value={text} onChange={e=>setText(e.target.value)}/>
          <div style={{display:"flex",gap:10}}>
            {!started?(
              <button className="btn btn-p" onClick={start} disabled={!text.trim()} style={{width:"auto"}}>▶ Start Reading</button>
            ):(
              <button className="btn btn-p" onClick={finish} style={{width:"auto",background:"var(--green)"}}>✅ Done Reading</button>
            )}
            {started&&<div style={{fontSize:13,color:"var(--ink2)",display:"flex",alignItems:"center"}}>📖 Reading... {text.trim().split(/\s+/).length} words</div>}
          </div>
        </div>
      ):(
        <div className="card" style={{textAlign:"center",padding:36}}>
          <div style={{fontSize:"3rem",fontWeight:800,color:"var(--v)",letterSpacing:"-.05em",marginBottom:8}}>{wpm} WPM</div>
          <div style={{color:"var(--ink2)",marginBottom:16}}>
            {wpm>=400?"📚 Speed Reader!":wpm>=250?"👍 Above Average":wpm>=150?"📖 Average Reader":"🐢 Take your time!"}
          </div>
          <button className="btn btn-p" onClick={reset} style={{width:"auto"}}>🔄 Try Again</button>
        </div>
      )}
      {history.length>0&&(
        <div className="card" style={{marginTop:14}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--ink)",marginBottom:10}}>📊 Reading History</div>
          {history.map((h,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(234,88,12,.06)",fontSize:13}}>
              <span style={{color:"var(--ink2)"}}>{h.date} · {h.words} words</span>
              <span style={{fontWeight:700,color:"var(--v)"}}>{h.wpm} WPM</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Multi PDF Chat ──
function MultiPDFChat({lang,pdfLoaded}){
  const [msgs,setMsgs]=useState([])
  const [inp,setInp]=useState("")
  const [busy,setBusy]=useState(false)
  const endRef=useRef()
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[msgs])

  const send=async()=>{
    if(!inp.trim())return
    const q=inp;setInp("")
    setMsgs(m=>[...m,{r:"user",t:q}])
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{
        question:`[Multi-PDF Analysis] ${q}`,language:lang
      })
      setMsgs(m=>[...m,{r:"ai",t:data.answer}])
    }catch{setMsgs(m=>[...m,{r:"ai",t:"Error — upload multiple PDFs first!"}])}
    setBusy(false)
  }

  return(
    <div>
      <div className="sec-title">📚 Multi PDF Chat</div>
      <div className="sec-sub">Chat across ALL your uploaded PDFs simultaneously</div>
      {!pdfLoaded?(
        <div className="card" style={{textAlign:"center",padding:32,color:"var(--ink2)"}}>Upload multiple PDFs first from the hero page!</div>
      ):(
        <div className="card">
          <div style={{background:"rgba(234,88,12,.06)",borderRadius:10,padding:"8px 12px",marginBottom:12,fontSize:12,color:"var(--ink2)"}}>
            💡 Ask questions that span across all your uploaded documents
          </div>
          <div className="chat-box" style={{minHeight:250}}>
            {!msgs.length&&<div style={{color:"var(--ink2)",fontSize:14,textAlign:"center",paddingTop:60}}>Ask anything across all PDFs! 📚</div>}
            {msgs.map((m,i)=><div key={i} className={"msg "+(m.r)}>{m.t}</div>)}
            {busy&&<div className="msg ai"><span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/></div>}
            <div ref={endRef}/>
          </div>
          <div className="chat-row">
            <input className="chat-in" value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Compare, contrast, or ask across all PDFs..."/>
            <button className="btn btn-p" onClick={send} disabled={busy||!inp.trim()}>Send</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Auto Quiz After Notes ──
function AutoQuizModal({show,onClose,lang}){
  const [qs,setQs]=useState([])
  const [qi,setQi]=useState(0)
  const [sc,setSc]=useState(0)
  const [sel,setSel]=useState(null)
  const [ans,setAns]=useState(false)
  const [done,setDone]=useState(false)
  const [busy,setBusy]=useState(false)

  useEffect(()=>{
    if(show){
      setBusy(true)
      axios.post(API+"/quiz",{language:lang,difficulty:"Mixed"})
        .then(({data})=>{setQs(data.questions);setBusy(false)})
        .catch(()=>setBusy(false))
    }
  },[show])

  if(!show)return null
  const pick=o=>{if(ans)return;setSel(o);setAns(true);if(o===qs[qi]?.answer)setSc(s=>s+1)}
  const next=()=>{if(qi+1<qs.length){setQi(i=>i+1);setSel(null);setAns(false)}else setDone(true)}

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{maxWidth:560}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:18,fontWeight:800,color:"var(--ink)"}}>🧪 Quick Quiz</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"var(--ink3)"}}>✕</button>
        </div>
        {busy?<div style={{textAlign:"center",padding:32}}><Spin/> Generating quiz...</div>:
        done?<div style={{textAlign:"center",padding:20}}>
          <div style={{fontSize:"2.5rem",fontWeight:800,color:"var(--v)",marginBottom:8}}>{sc}/{qs.length}</div>
          <div style={{color:"var(--ink2)",marginBottom:16}}>{Math.round(sc/qs.length*100)}% correct!</div>
          <button className="btn btn-p" onClick={onClose} style={{width:"auto"}}>Close</button>
        </div>:qs.length>0&&<>
          <div className="qcard"><div className="qnum">Q{qi+1}/{qs.length}</div><div className="qtext">{qs[qi].question}</div></div>
          {qs[qi].options.map(o=>{let c="qopt";if(ans){if(o===qs[qi].answer)c+=" correct";else if(o===sel)c+=" wrong"}return<button key={o} className={c} onClick={()=>pick(o)} disabled={ans}>{o}</button>})}
          {ans&&<button className="btn btn-p" onClick={next} style={{marginTop:8,width:"auto"}}>{qi+1<qs.length?"Next ▶":"Results 🏁"}</button>}
        </>}
      </div>
    </div>
  )
}


// ── Code Features ──
const CODE_LANGS = ["Python","JavaScript","Java","C++","C","TypeScript","React","SQL","HTML/CSS","Rust","Go","Swift"]

function CodeEditor({value,onChange,placeholder,height=200}){
  return(
    <textarea
      className="inp"
      value={value}
      onChange={e=>onChange(e.target.value)}
      placeholder={placeholder||"// Paste your code here..."}
      style={{
        fontFamily:"DM Mono,monospace",fontSize:13,height,
        background:"#1A1A2E",color:"#E2E8F0",
        border:"1px solid rgba(234,88,12,.2)",borderRadius:12,
        resize:"vertical",lineHeight:1.7,padding:"14px 16px"
      }}
    />
  )
}

function CodeResult({result}){
  const [copied,setCopied]=useState(false)
  if(!result)return null
  return(
    <div className="card" style={{marginTop:14,position:"relative"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,fontFamily:"DM Mono,monospace",color:"var(--v)",letterSpacing:".1em"}}>AI RESPONSE</div>
        <button onClick={()=>{navigator.clipboard.writeText(result);setCopied(true);setTimeout(()=>setCopied(false),2000)}}
          style={{background:"none",border:"1px solid rgba(234,88,12,.2)",borderRadius:8,padding:"3px 10px",fontSize:11,color:copied?"var(--green)":"var(--ink3)",cursor:"pointer",fontFamily:"DM Mono,monospace"}}>
          {copied?"✅ Copied":"📋 Copy"}
        </button>
      </div>
      <pre style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.7,color:"var(--ink)",fontFamily:"DM Mono,monospace",overflowX:"auto"}}>{result}</pre>
    </div>
  )
}

// ── Code Generator ──
function CodeGeneratorTab({lang}){
  const [desc,setDesc]=useState("")
  const [language,setLanguage]=useState("Python")
  const [result,setResult]=useState("")
  const [busy,setBusy]=useState(false)

  const generate=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{
        question:`Write clean, well-commented ${language} code for: "${desc}"
Requirements:
- Add helpful comments explaining each section
- Follow best practices for ${language}
- Include example usage at the bottom
- Handle edge cases

Provide ONLY the code with comments, no extra explanation outside the code block.`,
        language:"English"
      })
      setResult(data.answer)
    }catch{alert("Error!")}
    setBusy(false)
  }

  return(
    <div>
      <div className="sec-title">⚡ Code Generator</div>
      <div className="sec-sub">Describe what you want — AI writes the code</div>
      <div className="card">
        <div style={{display:"flex",gap:12,marginBottom:12}}>
          <div style={{flex:1}}>
            <label className="lbl">Language</label>
            <select className="sel" value={language} onChange={e=>setLanguage(e.target.value)} style={{marginBottom:0}}>
              {CODE_LANGS.map(l=><option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <label className="lbl">What should the code do?</label>
        <textarea className="inp" style={{height:100,resize:"vertical"}} placeholder="e.g. A function that sorts a list of students by their grades..." value={desc} onChange={e=>setDesc(e.target.value)}/>
        <button className="btn btn-p" onClick={generate} disabled={busy||!desc.trim()} style={{width:"auto"}}>{busy?<><Spin/>Generating...</>:"⚡ Generate Code"}</button>
      </div>
      <CodeResult result={result}/>
    </div>
  )
}

// ── Code Debugger ──
function CodeDebuggerTab(){
  const [code2,setCode2]=useState("")
  const [error,setError]=useState("")
  const [language,setLanguage]=useState("Python")
  const [result,setResult]=useState("")
  const [busy,setBusy]=useState(false)

  const debug=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{
        question:`Debug this ${language} code${error?` that gives error: "${error}"`:""}:

\`\`\`${language.toLowerCase()}
${code2}
\`\`\`

Please:
1. Identify ALL bugs and issues
2. Explain what each bug does
3. Provide the FIXED code
4. Explain what you changed and why`,
        language:"English"
      })
      setResult(data.answer)
    }catch{alert("Error!")}
    setBusy(false)
  }

  return(
    <div>
      <div className="sec-title">🐛 Code Debugger</div>
      <div className="sec-sub">Paste broken code — AI finds and fixes all bugs</div>
      <div className="card">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label className="lbl">Language</label>
            <select className="sel" value={language} onChange={e=>setLanguage(e.target.value)} style={{marginBottom:0}}>
              {CODE_LANGS.map(l=><option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Error message (optional)</label>
            <input className="inp" style={{marginBottom:0}} placeholder="e.g. TypeError: cannot read..." value={error} onChange={e=>setError(e.target.value)}/>
          </div>
        </div>
        <label className="lbl">Paste your buggy code</label>
        <CodeEditor value={code2} onChange={setCode2} height={180}/>
        <button className="btn btn-p" onClick={debug} disabled={busy||!code2.trim()} style={{width:"auto",marginTop:10}}>{busy?<><Spin/>Debugging...</>:"🐛 Find & Fix Bugs"}</button>
      </div>
      <CodeResult result={result}/>
    </div>
  )
}

// ── Code Reviewer ──
function CodeReviewerTab(){
  const [code2,setCode2]=useState("")
  const [language,setLanguage]=useState("Python")
  const [focus,setFocus]=useState("All")
  const [result,setResult]=useState("")
  const [busy,setBusy]=useState(false)

  const review=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{
        question:`Review this ${language} code with focus on ${focus}:

\`\`\`${language.toLowerCase()}
${code2}
\`\`\`

Provide detailed review covering:
## Code Quality
## Performance Issues
## Security Concerns
## Best Practices
## Suggestions for Improvement
## Overall Score: X/10`,
        language:"English"
      })
      setResult(data.answer)
    }catch{alert("Error!")}
    setBusy(false)
  }

  return(
    <div>
      <div className="sec-title">👀 Code Reviewer</div>
      <div className="sec-sub">Get expert feedback on your code quality</div>
      <div className="card">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label className="lbl">Language</label>
            <select className="sel" value={language} onChange={e=>setLanguage(e.target.value)} style={{marginBottom:0}}>
              {CODE_LANGS.map(l=><option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Focus Area</label>
            <select className="sel" value={focus} onChange={e=>setFocus(e.target.value)} style={{marginBottom:0}}>
              {["All","Performance","Security","Readability","Best Practices","Bug Detection"].map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <label className="lbl">Paste your code</label>
        <CodeEditor value={code2} onChange={setCode2} height={180}/>
        <button className="btn btn-p" onClick={review} disabled={busy||!code2.trim()} style={{width:"auto",marginTop:10}}>{busy?<><Spin/>Reviewing...</>:"👀 Review Code"}</button>
      </div>
      <CodeResult result={result}/>
    </div>
  )
}

// ── Algorithm Visualizer ──
function AlgorithmVisualizerTab(){
  const [algo,setAlgo]=useState("Bubble Sort")
  const [arr,setArr]=useState([64,34,25,12,22,11,90])
  const [steps,setSteps]=useState([])
  const [step,setStep]=useState(0)
  const [explanation,setExplanation]=useState("")
  const [busy,setBusy]=useState(false)

  const ALGOS=["Bubble Sort","Selection Sort","Insertion Sort","Linear Search","Binary Search","Fibonacci","Factorial"]

  const generateSteps=()=>{
    const a=[...arr]
    const s=[]
    if(algo==="Bubble Sort"){
      for(let i=0;i<a.length;i++){
        for(let j=0;j<a.length-i-1;j++){
          s.push({arr:[...a],comparing:[j,j+1],sorted:Array.from({length:i},(_,k)=>a.length-1-k)})
          if(a[j]>a[j+1]){[a[j],a[j+1]]=[a[j+1],a[j]]}
        }
      }
      s.push({arr:[...a],comparing:[],sorted:Array.from({length:a.length},(_,k)=>k)})
    }
    setSteps(s);setStep(0)
  }

  const getExplanation=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{
        question:`Explain the ${algo} algorithm simply:
1. How it works (step by step)
2. Time complexity (Big O)
3. Space complexity
4. When to use it
5. Real world example
Keep it concise and beginner-friendly.`,
        language:"English"
      })
      setExplanation(data.answer)
    }catch{}
    setBusy(false)
  }

  const current=steps[step]||{arr,comparing:[],sorted:[]}

  return(
    <div>
      <div className="sec-title">🔢 Algorithm Visualizer</div>
      <div className="sec-sub">Watch sorting algorithms step by step</div>
      <div className="card">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div>
            <label className="lbl">Algorithm</label>
            <select className="sel" value={algo} onChange={e=>{setAlgo(e.target.value);setSteps([]);setStep(0)}} style={{marginBottom:0}}>
              {ALGOS.map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Array (comma separated)</label>
            <input className="inp" style={{marginBottom:0}} value={arr.join(",")} onChange={e=>{try{setArr(e.target.value.split(",").map(Number).filter(n=>!isNaN(n)))}catch{}}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn btn-p" onClick={generateSteps} style={{width:"auto"}}>▶ Visualize</button>
          <button className="btn" onClick={getExplanation} disabled={busy} style={{width:"auto"}}>{busy?<><Spin/>...</>:"📖 Explain"}</button>
        </div>
      </div>

      {steps.length>0&&(
        <div className="card" style={{marginTop:14}}>
          <div style={{fontSize:12,color:"var(--ink2)",marginBottom:16,fontFamily:"DM Mono,monospace"}}>
            Step {step+1} of {steps.length}
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,marginBottom:16,justifyContent:"center"}}>
            {current.arr.map((v,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{
                  width:36,background:
                    current.sorted?.includes(i)?"var(--green)":
                    current.comparing?.includes(i)?"var(--v)":"var(--bg3)",
                  height:v*1.2,borderRadius:"6px 6px 0 0",transition:"all .3s",
                  minHeight:20,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:4
                }}>
                  <span style={{fontSize:10,fontWeight:700,color:current.comparing?.includes(i)||current.sorted?.includes(i)?"white":"var(--ink2)"}}>{v}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button className="btn" disabled={step===0} onClick={()=>setStep(s=>s-1)} style={{width:"auto"}}>◀ Prev</button>
            <button className="btn" disabled={step===steps.length-1} onClick={()=>setStep(s=>s+1)} style={{width:"auto"}}>Next ▶</button>
          </div>
          <div style={{display:"flex",gap:12,marginTop:12,justifyContent:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--ink2)"}}><div style={{width:12,height:12,background:"var(--v)",borderRadius:3}}/> Comparing</div>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--ink2)"}}><div style={{width:12,height:12,background:"var(--green)",borderRadius:3}}/> Sorted</div>
          </div>
        </div>
      )}
      {explanation&&<div className="card" style={{marginTop:14,whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.7}}>{explanation}</div>}
    </div>
  )
}

// ── Code Quiz ──
function CodeQuizTab(){
  const [language,setLanguage]=useState("Python")
  const [difficulty,setDifficulty]=useState("Beginner")
  const [qs,setQs]=useState([])
  const [qi,setQi]=useState(0)
  const [sc,setSc]=useState(0)
  const [sel,setSel]=useState(null)
  const [ans,setAns]=useState(false)
  const [done,setDone]=useState(false)
  const [busy,setBusy]=useState(false)

  const generate=async()=>{
    setBusy(true)
    try{
      const{data}=await axios.post(API+"/chat",{
        question:`Create 6 ${difficulty} level multiple choice quiz questions about ${language} programming.
Return ONLY valid JSON array:
[{"question":"What does X do?","options":["A) opt1","B) opt2","C) opt3","D) opt4"],"answer":"A) opt1","explanation":"Brief explanation"}]
Focus on: syntax, concepts, output prediction, error detection.`,
        language:"English"
      })
      const match=data.answer.match(/\[[\s\S]*\]/)
      if(match){
        setQs(JSON.parse(match[0]))
        setQi(0);setSc(0);setSel(null);setAns(false);setDone(false)
      }
    }catch{alert("Error generating quiz!")}
    setBusy(false)
  }

  const pick=o=>{if(ans)return;setSel(o);setAns(true);if(o===qs[qi]?.answer)setSc(s=>s+1)}
  const next=()=>{if(qi+1<qs.length){setQi(i=>i+1);setSel(null);setAns(false)}else setDone(true)}

  return(
    <div>
      <div className="sec-title">💻 Code Quiz</div>
      <div className="sec-sub">Test your programming knowledge</div>
      {(!qs.length||done)&&(
        <>
          {done&&<div className="card" style={{textAlign:"center",padding:32,marginBottom:16}}>
            <div style={{fontSize:"3rem",fontWeight:800,color:"var(--v)",letterSpacing:"-.05em"}}>{sc}/{qs.length}</div>
            <div style={{color:"var(--ink2)",marginTop:6}}>{Math.round(sc/qs.length*100)}% — {sc/qs.length>=.7?"Great job! 🔥":"Keep practicing! 💪"}</div>
          </div>}
          <div className="card">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label className="lbl">Language</label>
                <select className="sel" value={language} onChange={e=>setLanguage(e.target.value)}>
                  {CODE_LANGS.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl">Difficulty</label>
                <select className="sel" value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
                  {["Beginner","Intermediate","Advanced","Expert"].map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-p" onClick={generate} disabled={busy} style={{width:"auto"}}>{busy?<><Spin/>Generating...</>:done?"🔄 New Quiz":"💻 Start Code Quiz"}</button>
          </div>
        </>
      )}
      {qs.length>0&&!done&&(
        <>
          <div className="prog"><div className="prog-fill" style={{width:`${(qi/qs.length)*100}%`}}/></div>
          <p style={{fontSize:12,color:"var(--ink2)",margin:"5px 0 12px",textAlign:"right"}}>{language} · {difficulty} · Q{qi+1}/{qs.length} · Score:{sc}</p>
          <div className="qcard">
            <div className="qnum">💻 {language.toUpperCase()} QUESTION {qi+1}</div>
            <div className="qtext" style={{fontFamily:"DM Mono,monospace",fontSize:15}}>{qs[qi].question}</div>
          </div>
          {qs[qi].options.map(o=>{
            let c="qopt"
            if(ans){if(o===qs[qi].answer)c+=" correct";else if(o===sel)c+=" wrong"}
            return<button key={o} className={c} style={{fontFamily:"DM Mono,monospace"}} onClick={()=>pick(o)} disabled={ans}>{o}</button>
          })}
          {ans&&(
            <>
              {qs[qi].explanation&&<div className="card" style={{background:"rgba(234,88,12,.04)",marginBottom:8,fontSize:13,color:"var(--ink2)"}}>💡 {qs[qi].explanation}</div>}
              <button className="btn btn-p" onClick={next} style={{width:"auto"}}>{qi+1<qs.length?"Next ▶":"Results 🏁"}</button>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Sound Effects ──
const sounds = {
  click:   ()=>{ const a=new AudioContext(); const o=a.createOscillator(); const g=a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value=800; g.gain.setValueAtTime(.1,a.currentTime); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.1); o.start(); o.stop(a.currentTime+.1) },
  success: ()=>{ const a=new AudioContext(); [600,800,1000].forEach((f,i)=>{ const o=a.createOscillator(); const g=a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value=f; g.gain.setValueAtTime(.08,a.currentTime+i*.08); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+i*.08+.15); o.start(a.currentTime+i*.08); o.stop(a.currentTime+i*.08+.15) }) },
  pop:     ()=>{ const a=new AudioContext(); const o=a.createOscillator(); const g=a.createGain(); o.type="sine"; o.connect(g); g.connect(a.destination); o.frequency.setValueAtTime(400,a.currentTime); o.frequency.exponentialRampToValueAtTime(200,a.currentTime+.08); g.gain.setValueAtTime(.1,a.currentTime); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.08); o.start(); o.stop(a.currentTime+.08) }
}

// ── Toast Notification ──
function Toast({msg,onClose}){
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t)},[])
  return(
    <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:"var(--ink)",color:"white",padding:"12px 20px",borderRadius:12,fontSize:13,fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,0.2)",animation:"riseUp .3s ease both",display:"flex",alignItems:"center",gap:8}}>
      ✅ {msg}
    </div>
  )
}

// ── Progress Tracker ──
function ProgressBar({label,value,max,color="#EA580C"}){
  const pct=Math.min(100,Math.round((value/Math.max(max,1))*100))
  return(
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--ink2)",marginBottom:4}}>
        <span>{label}</span><span style={{fontFamily:"DM Mono",color:color}}>{value}/{max}</span>
      </div>
      <div style={{background:"var(--bg3)",borderRadius:100,height:6,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${color},#F43F5E)`,borderRadius:100,transition:"width .5s cubic-bezier(.4,0,.2,1)"}}/>
      </div>
    </div>
  )
}

// ── Share Modal ──
function ShareModal({content,title,onClose}){
  const [copied,setCopied]=useState(false)
  const url=`data:text/plain;charset=utf-8,${encodeURIComponent(content)}`
  const copy=()=>{ navigator.clipboard.writeText(content); setCopied(true); setTimeout(()=>setCopied(false),2000) }
  return(
    <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"var(--white)",borderRadius:24,padding:28,maxWidth:480,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.2)",animation:"riseUp .3s ease both"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:18,fontWeight:800,color:"var(--ink)",marginBottom:6,letterSpacing:"-.03em"}}>📤 Share {title}</div>
        <div style={{fontSize:13,color:"var(--ink2)",marginBottom:16}}>Copy or download your content</div>
        <textarea readOnly value={content} style={{width:"100%",height:120,padding:12,border:"1.5px solid rgba(234,88,12,.15)",borderRadius:12,fontFamily:"DM Mono",fontSize:12,color:"var(--ink2)",background:"var(--bg2)",resize:"none",outline:"none",marginBottom:12}}/>
        <div style={{display:"flex",gap:10}}>
          <button className="btn btn-p" onClick={copy} style={{flex:1}}>{copied?"✅ Copied!":"📋 Copy"}</button>
          <a href={url} download={(title)+".txt"} style={{flex:1}}><button className="btn" style={{width:"100%"}}>⬇️ Download</button></a>
          <button className="btn" onClick={onClose} style={{width:"auto"}}>✕</button>
        </div>
      </div>
    </div>
  )
}

export default function App(){
  const [tab,setTab]=useState("Chat")
  const [ok,setOk]=useState(false)
  const [busy,setBusy]=useState(false)
  const [info,setInfo]=useState({files:0,chunks:0,q:0,fc:0,notes:0,quiz:0,yt:0,essay:0,lang:0,streak:1})
  const [lang,setLang]=useState("English")
  const [dark,setDark]=useDark()
  useEffect(()=>{
    const savedTheme=localStorage.getItem("ml_theme")
    if(savedTheme&&THEMES[savedTheme]){
      Object.entries(THEMES[savedTheme]).forEach(([k,v])=>document.documentElement.style.setProperty(k,v))
    }
    const savedPrompt=localStorage.getItem("ml_sysprompt")
    if(savedPrompt) window._mlSystemPrompt=savedPrompt
  },[])
  const [bms,addBm,removeBm]=useBookmarks()
  const [notifs,setNotifs]=useState([])
  const addNotif=text=>setNotifs(n=>[{text,time:new Date().toLocaleTimeString(),read:false},...n].slice(0,10))
  const [toast,setToast]=useState("")
  const [share,setShare]=useState(null)
  const [history,setHistory]=useState(()=>JSON.parse(localStorage.getItem("ml_history")||"[]"))
  const [showHistory,setShowHistory]=useState(true)
  const [exportData,setExportData]=useState(null)
  const [autoQuiz,setAutoQuiz]=useState(false)
  const [soundOn,setSoundOn]=useState(true)

  const play=k=>{ if(soundOn) try{sounds[k]()}catch{} }

  // Keyboard shortcuts
  useEffect(()=>{
    const h=e=>{
      if(!ok)return
      if(e.ctrlKey||e.metaKey){
        const map={1:"Chat",2:"Notes",3:"Flashcards",4:"Quiz",5:"YouTube",6:"Essay",7:"ELI5"}
        if(map[e.key]){e.preventDefault();setTab(map[e.key]);play("click")}
      }
    }
    window.addEventListener("keydown",h)
    return()=>window.removeEventListener("keydown",h)
  },[ok,soundOn])

  const showToast=msg=>{setToast(msg);play("success");addNotif(msg)}

  const up=async fd=>{
    setBusy(true)
    play("click")
    try{
      const{data}=await axios.post(API+"/upload",fd)
      setOk(true)
      const files=data.files||[]
      setInfo(x=>({...x,files:files.length,chunks:data.chunks||0}))
      // Save to history
      const entry={id:Date.now(),files,chunks:data.chunks,date:new Date().toLocaleDateString()}
      const newH=[entry,...history].slice(0,5)
      setHistory(newH)
      localStorage.setItem("ml_history",JSON.stringify(newH))
      showToast(`${files.length} PDF${files.length>1?"s":""} processed!`)
    }
    catch{alert("Upload failed! Make sure backend is running:\ncd mindlearn-app/backend && uvicorn main:app --port 8000")}
    setBusy(false)
  }

  const tabs={
    Chat:<Chat lang={lang} onQ={()=>{setInfo(x=>({...x,q:x.q+1}));play("pop")}} addBm={addBm}/>,
    Notes:<Notes lang={lang} onShare={c=>setShare({content:c,title:"Notes"})} onExport={c=>setExportData({content:c,title:"Notes"})} onDone={()=>{setInfo(x=>({...x,notes:x.notes+1}));showToast("Notes generated!");setTimeout(()=>setAutoQuiz(true),1000)}}/>,
    Flashcards:<Flashcards lang={lang} onDone={n=>{setInfo(x=>({...x,fc:n}));showToast(`${n} flashcards created!`);play("success")}}/>,
    Quiz:<Quiz lang={lang} onDone={(s,t)=>{setInfo(x=>({...x,quiz:s}));showToast(`Quiz done! Score: ${s}/${t}`);const username=localStorage.getItem("ml_username")||"Anonymous";const prev=JSON.parse(localStorage.getItem("ml_scores")||"[]");prev.push({name:username,score:s,total:t,pct:Math.round((s/t)*100),date:new Date().toLocaleDateString()});localStorage.setItem("ml_scores",JSON.stringify(prev.slice(-50)))}}/>,
    YouTube:<YouTube onDone={()=>setInfo(x=>({...x,yt:x.yt+1}))}/>,
    Essay:<Essay lang={lang} onShare={c=>setShare({content:c,title:"Essay"})} onExport={c=>setExportData({content:c,title:"Essay"})} onDone={()=>setInfo(x=>({...x,essay:x.essay+1}))}/>,
    ELI5:<ELI5 lang={lang}/>,
    Compare:<CompareTab/>,
    "🎨 Image":<ImageGenTab/>,
    "🏆 Achievements":<AchievementsPanel info={info}/>,
    "⏱️ Pomodoro":<PomodoroTab/>,
    "🎮 Vocab Quiz":<VocabQuizTab lang={lang}/>,
    "🗺️ Map":<ConceptMapTab/>,
    "📅 Study Plan":<StudyPlanTab lang={lang}/>,
    "🎤 Interview":<MockInterviewTab lang={lang}/>,
    "🔖 Bookmarks":<BookmarksTab/>,
    "🎨 Theme":<ThemePicker/>,
    "🏆 Scores":<LeaderboardTab/>,
    "⚙️ Prompt":<CustomPromptTab/>,
    "⌨️ Typing":<TypingTestTab/>,
    "🧠 Mnemonics":<MnemonicsTab lang={lang}/>,
    "📊 Difficulty":<DifficultyRater/>,
    "🔁 SRS":<SpacedRepetitionTab lang={lang}/>,
    "⚖️ Debate":<SelfDebateTab lang={lang}/>,
    "📖 Reading":<ReadingTrackerTab/>,
    "📚 Multi PDF":<MultiPDFChat lang={lang} pdfLoaded={ok}/>,
    "⚡ Code Gen":<CodeGeneratorTab lang={lang}/>,
    "🐛 Debugger":<CodeDebuggerTab/>,
    "👀 Reviewer":<CodeReviewerTab/>,
    "🔢 Algorithm":<AlgorithmVisualizerTab/>,
    "💻 Code Quiz":<CodeQuizTab/>
  }

  return(
    <>
      <Nav tab={tab} setTab={t=>{setTab(t);play("click")}} ok={ok} dark={dark} onDark={()=>setDark(d=>!d)} notifs={notifs} onClearNotifs={()=>setNotifs([])}/>

      {!ok?(
        <>
          <Hero onUp={up} busy={busy} isDragDrop={true}/>
          {/* PDF History */}
          {history.length>0&&(
            <div style={{maxWidth:600,margin:"-20px auto 40px",padding:"0 20px"}}>
              <button className="btn" style={{width:"100%",marginBottom:10,fontSize:13}} onClick={()=>setShowHistory(s=>!s)}>
                📚 Recent Sessions ({history.length}) {showHistory?"▲":"▼"}
              </button>
              {showHistory&&(
                <div className="card">
                  {history.map(h=>(
                    <div key={h.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(234,88,12,.08)"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"var(--ink)"}}>{h.files?.join(", ")||"PDF"}</div>
                        <div style={{fontSize:11,color:"var(--ink3)",fontFamily:"DM Mono"}}>{h.date} · {h.chunks} chunks</div>
                      </div>
                      <span className="chip">📄 {h.files?.length||1} file</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ):(
        <div className="main">
          <Dash info={info}/>

          {/* Progress Tracker */}
          <div className="card" style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--ink)",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>📊 Session Progress</span>
              <button className="btn" style={{width:"auto",padding:"4px 10px",fontSize:11}} onClick={()=>setSoundOn(s=>!s)}>
                {soundOn?"🔊":"🔇"} Sound
              </button>
            </div>
            <ProgressBar label="Questions Asked" value={info.q} max={10} color="#EA580C"/>
            <ProgressBar label="Notes Generated" value={info.notes} max={3} color="#F43F5E"/>
            <ProgressBar label="Flashcards Made" value={info.fc} max={8} color="#FB923C"/>
            <ProgressBar label="Quiz Score" value={info.quiz} max={6} color="#10B981"/>
          </div>

          {/* Keyboard shortcuts hint */}
          <div style={{fontSize:11,color:"var(--ink3)",fontFamily:"DM Mono",marginBottom:8,textAlign:"right"}}>
            ⌨️ Shortcuts: ⌘1-7 to switch tabs
          </div>

          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap",paddingTop:4}}>
            <span style={{fontSize:11,color:"var(--ink3)",fontFamily:"DM Mono"}}>LANGUAGE:</span>
            {["English","Hindi","Hinglish"].map(l=><button key={l} className="btn" style={{width:"auto",padding:"5px 13px",fontSize:12,background:lang===l?"var(--v)":"var(--bg2)",color:lang===l?"white":"var(--v)"}} onClick={()=>{setLang(l);play("click")}}>{l}</button>)}
            <button className="btn" style={{width:"auto",padding:"5px 13px",fontSize:12,marginLeft:"auto"}} onClick={()=>{setOk(false);setInfo({files:0,chunks:0,q:0,fc:0,notes:0,quiz:0})}}>📄 New PDF</button>
          </div>
          <MotivationCard/>
          <PDFInfoCard info={info}/>
          <SummaryBar lang={lang}/>
          <div className="tab-bar">{Object.keys(tabs).map(t=><button key={t} className={"tab-btn"+(tab===t?" active":"")} onClick={()=>{setTab(t);play("click")}}>{t}</button>)}</div>
          <div style={{animation:"riseUp .35s ease both"}}>{tabs[tab]}</div>
        </div>
      )}

      <footer className="footer">
        <div className="ft-logo">🧠 MindLearn AI</div>
        <div className="ft-sub">Your PDF just got a superpower.</div>
        <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontFamily:"DM Mono",marginBottom:8}}>⌨️ Press ⌘1-7 to switch tabs quickly</div>
        <div className="ft-copy">React · FastAPI · Groq · LangChain · ChromaDB</div>
      </footer>

      {toast&&<Toast msg={toast} onClose={()=>setToast("")}/>}
      {share&&<ShareModal content={share.content} title={share.title} onClose={()=>setShare(null)}/> }
      {exportData&&<ExportModal content={exportData.content} title={exportData.title} onClose={()=>setExportData(null)}/>}
      <AutoQuizModal show={autoQuiz} onClose={()=>setAutoQuiz(false)} lang={lang}/>
    </>
  )
}
