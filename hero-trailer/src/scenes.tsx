import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Spectral';

loadFont('normal', {weights: ['400', '500', '600', '700']});
loadFont('italic', {weights: ['400', '500']});

const T = {
  bg: '#0a0b1a', card: 'rgba(14,15,36,.86)', ink: '#ece9ff', muted: '#8b8ab0',
  line: 'rgba(160,158,230,.16)', indigo: '#6b69e6', amber: '#ffb454',
  green: '#34d399', blue: '#38bdf8', violet: '#a78bfa', purple: '#a855f7',
  steel: '#9fb3c8', graphite: '#0b0d12',
};
const serif = "'Spectral', Georgia, serif";
const sans = "'Spectral', Georgia, serif";

const SceneFrame = ({children, admin = false, frame = 0}: {children: React.ReactNode; admin?: boolean; frame?: number}) => {
  const intro = interpolate(frame, [0, 20], [0, 1], {extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 1, 0.36, 1)});
  const stars = Array.from({length: 70}, (_, i) => <i key={i} style={{position: 'absolute', left: `${(i * 71 + 9) % 100}%`, top: `${(i * 43 + 4) % 100}%`, width: i % 9 === 0 ? 3 : 2, height: i % 9 === 0 ? 3 : 2, borderRadius: 9, background: T.ink, opacity: admin ? 0.12 : 0.18 + (i % 4) * 0.06}} />);
  return <AbsoluteFill style={{overflow: 'hidden', color: T.ink, fontFamily: sans, background: admin ? T.graphite : T.bg}}>
    {stars}
    <AbsoluteFill style={{background: admin ? 'radial-gradient(ellipse at 55% 45%, rgba(159,179,200,.09), transparent 62%)' : 'radial-gradient(ellipse at 50% 38%, rgba(107,105,230,.22), transparent 58%)'}} />
    <AbsoluteFill style={{opacity: intro, transform: `translateY(${(1 - intro) * 24}px)`}}>{children}</AbsoluteFill>
  </AbsoluteFill>;
};

const Logo = ({size = 42}: {size?: number}) => <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
  <div style={{width: size, height: size, border: `2px solid ${T.amber}`, borderRadius: size * 0.28, display: 'grid', placeItems: 'center', color: T.amber, fontFamily: serif, fontWeight: 700, fontSize: size * 0.62, boxShadow: '0 0 36px rgba(255,180,84,.2)'}}>H</div>
  <b style={{fontFamily: serif, fontSize: size * 0.62, letterSpacing: '.28em'}}>HERO</b>
</div>;

const Panel = ({children, style = {}}: {children: React.ReactNode; style?: React.CSSProperties}) => <div style={{position: 'relative', overflow: 'hidden', borderRadius: 24, border: `1px solid ${T.line}`, background: T.card, boxShadow: '0 28px 80px rgba(0,0,0,.34)', ...style}}>
  <i style={{position: 'absolute', left: 28, top: 0, width: 72, height: 3, borderRadius: '0 0 3px 3px', background: `linear-gradient(90deg, ${T.indigo}, ${T.amber})`}} />
  {children}
</div>;

const Tag = ({children}: {children: React.ReactNode}) => <span style={{display: 'inline-block', borderRadius: 999, padding: '9px 17px', background: T.amber, color: '#1d160e', fontFamily: sans, fontSize: 16, fontWeight: 700, letterSpacing: '.09em'}}>{children}</span>;

const Header = ({admin = false}: {admin?: boolean}) => <div style={{position: 'absolute', top: 42, left: 84, right: 84, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
  <Logo />
  <div style={{color: admin ? T.steel : T.muted, fontFamily: sans, fontSize: 17, letterSpacing: '.16em'}}>WHERE HISTORY HAPPENED</div>
</div>;

const Base = ({title, subtitle, children, tag, admin = false}: {title: string; subtitle: string; children: React.ReactNode; tag?: string; admin?: boolean}) => {
  const frame = useCurrentFrame();
  return <SceneFrame admin={admin} frame={frame}>
    <Header admin={admin}/>
    <div style={{position: 'absolute', top: 148, left: 90, right: 90, textAlign: 'center'}}>
      <div style={{fontFamily: serif, fontWeight: 700, fontSize: 74, lineHeight: 1.08, color: T.ink}}>{title}</div>
      <div style={{marginTop: 15, fontFamily: serif, fontSize: 29, color: admin ? T.steel : T.muted}}>{subtitle}</div>
    </div>
    <div style={{position: 'absolute', left: 110, right: 110, top: 350, height: 490, display: 'grid', placeItems: 'center'}}>{children}</div>
    {tag && <div style={{position: 'absolute', left: 0, right: 0, bottom: 92, textAlign: 'center', fontFamily: sans, fontSize: 18, fontWeight: 700, letterSpacing: '.14em', color: admin ? T.steel : T.amber}}>{tag}</div>}
  </SceneFrame>;
};

const MapArt = ({frame = 0, highlighted = false}: {frame?: number; highlighted?: boolean}) => {
  const ease = Easing.bezier(0.22, 1, 0.36, 1);
  const water = highlighted ? interpolate(frame, [12, 42], [0, 0.82], {extrapolateRight: 'clamp', easing: ease}) : 0;
  const land = highlighted ? interpolate(frame, [48, 82], [0, 0.78], {extrapolateRight: 'clamp', easing: ease}) : 0;
  const continent = highlighted ? interpolate(frame, [90, 126], [0, 0.68], {extrapolateRight: 'clamp', easing: ease}) : 0;
  const empire = highlighted ? interpolate(frame, [138, 174], [0, 0.76], {extrapolateRight: 'clamp', easing: ease}) : 0;
  const riverDraw = highlighted ? interpolate(frame, [180, 245], [1, 0], {extrapolateRight: 'clamp', easing: ease}) : 0;
  const pin = (at: number) => highlighted ? interpolate(frame, [at, at + 22], [0, 1], {extrapolateRight: 'clamp', easing: ease}) : 1;
  return <svg viewBox="0 0 860 400" preserveAspectRatio="xMidYMid meet" style={{width: '100%', height: '100%', overflow: 'visible'}}>
    <defs><radialGradient id="map-halo"><stop offset="0" stopColor="#6b69e6" stopOpacity=".2"/><stop offset="1" stopColor="#6b69e6" stopOpacity="0"/></radialGradient></defs>
    <ellipse cx="437" cy="205" rx="355" ry="188" fill="url(#map-halo)"/>
    <g fill="#171a38" stroke="#68699d" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M58 119 C62 96 76 76 102 65 C122 53 142 47 164 53 C181 54 192 65 210 69 C229 74 247 86 260 101 C273 114 263 127 247 132 C235 139 222 134 211 147 C199 160 187 168 171 175 C158 188 163 205 149 220 C137 233 124 218 119 202 C112 184 98 181 86 165 C72 149 63 136 58 119 Z"/>
      <path d="M184 204 C199 199 211 207 220 219 C228 231 236 235 247 244 C261 254 270 270 267 289 C265 315 252 343 240 365 C233 380 223 370 219 356 C212 338 211 317 203 298 C195 279 185 267 180 248 C176 232 176 214 184 204 Z"/>
      <path d="M321 116 C331 100 345 90 359 86 C373 77 385 68 402 70 C414 70 422 80 434 81 C447 82 456 91 460 102 C465 113 454 121 442 125 C428 130 414 124 401 132 C392 137 388 150 378 155 C368 160 359 151 352 145 C341 139 327 138 321 128 C318 124 318 120 321 116 Z"/>
      <path d="M384 165 C397 153 411 151 425 157 C437 162 450 156 463 159 C477 160 488 169 499 177 C514 187 522 201 528 218 C536 239 526 257 519 273 C512 291 504 309 492 325 C482 340 471 358 457 369 C445 378 434 365 430 351 C424 334 426 318 417 303 C408 287 393 276 388 257 C382 240 380 221 371 203 C365 188 372 174 384 165 Z"/>
      <path d="M449 106 C451 89 466 77 483 71 C498 63 515 58 533 63 C551 55 568 58 585 64 C601 66 618 70 634 78 C651 84 667 90 681 103 C696 115 700 127 690 139 C680 152 662 148 649 153 C635 159 624 168 610 178 C598 189 585 194 571 185 C558 177 549 166 534 162 C520 158 506 158 494 148 C481 140 470 135 459 124 C452 119 447 113 449 106 Z"/>
      <path d="M649 261 C660 249 676 244 691 248 C707 249 720 257 731 268 C741 280 740 295 730 305 C719 315 702 312 689 318 C675 322 660 316 651 306 C643 295 640 276 649 261 Z"/>
      <path d="M708 215 C717 210 727 212 734 219 C740 226 738 235 731 240 C724 244 715 241 710 235 C706 229 704 220 708 215 Z"/>
    </g>
    {highlighted && <g strokeLinejoin="round">
      <path d="M376 148 C396 138 420 141 437 148 C453 153 464 163 476 173 C458 181 439 180 421 177 C402 174 388 166 376 148 Z" fill={T.blue} opacity={water}/>
      <path d="M423 181 C435 178 447 183 456 193 C466 204 469 220 465 235 C460 250 452 261 446 277 C439 262 437 246 433 232 C429 217 419 199 423 181 Z" fill={T.green} opacity={land}/>
      <path d="M398 169 C415 158 434 161 450 171 C466 181 474 199 471 216 C460 207 447 204 435 204 C421 204 407 194 398 169 Z" fill={T.violet} opacity={continent}/>
      <path d="M465 157 C480 148 500 150 513 160 C524 168 530 182 528 195 C518 204 504 205 490 200 C477 195 465 179 465 157 Z" fill={T.purple} opacity={empire}/>
    </g>}
    <path d="M438 182 C442 198 445 213 447 229 C450 246 456 260 460 276 C464 292 469 309 478 324" fill="none" stroke={T.blue} strokeWidth="4" strokeLinecap="round" strokeDasharray="9 10" strokeDashoffset={riverDraw * 180} opacity={highlighted ? Math.max(0.28, riverDraw) : 0.72}/>
    <g filter="drop-shadow(0 0 9px rgba(255,255,255,.3))">
      <g opacity={pin(18)}><circle cx="444" cy="225" r="18" fill="none" stroke={T.blue} strokeWidth="2" opacity=".6"/><circle cx="444" cy="225" r="8" fill={T.blue}/></g>
      <g opacity={pin(56)}><circle cx="218" cy="146" r="17" fill="none" stroke={T.green} strokeWidth="2" opacity=".6"/><circle cx="218" cy="146" r="8" fill={T.green}/></g>
      <g opacity={pin(98)}><circle cx="549" cy="148" r="19" fill="none" stroke={T.violet} strokeWidth="2" opacity=".6"/><circle cx="549" cy="148" r="9" fill={T.violet}/></g>
      <g opacity={pin(146)}><circle cx="480" cy="193" r="19" fill="none" stroke={T.purple} strokeWidth="2" opacity=".6"/><circle cx="480" cy="193" r="9" fill={T.purple}/></g>
    </g>
  </svg>;
};

export const IntroScene = () => {
  const f = useCurrentFrame();
  const glow = interpolate(f, [0, 95, 119], [0.15, 0.6, 1], {extrapolateRight: 'clamp'});
  return <SceneFrame frame={f}><AbsoluteFill style={{display: 'grid', placeItems: 'center', textAlign: 'center'}}>
    <div style={{opacity: glow, transform: `scale(${0.86 + glow * 0.14}) rotateY(${(1 - glow) * -18}deg)`}}>
      <div style={{display: 'flex', justifyContent: 'center'}}><Logo size={92}/></div>
      <div style={{fontFamily: serif, fontSize: 91, fontWeight: 700, marginTop: 48}}>Studying, redefined.</div>
      <div style={{fontFamily: serif, color: T.amber, fontSize: 36, marginTop: 14}}>Meet Hero.</div>
    </div>
    <AbsoluteFill style={{background: '#fff', opacity: interpolate(f, [95, 100, 102, 108], [0, 1, 1, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'}), pointerEvents: 'none'}} />
  </AbsoluteFill></SceneFrame>;
};

export const HomeScene = () => <Base title="Geography with history attached." subtitle="Pick your tour: one year, or two." tag="QUOTE OF THE DAY  ·  YEAR TOGGLE">
  <Panel style={{width: 930, padding: 34, textAlign: 'center'}}>
    <div style={{borderLeft: `3px solid ${T.indigo}`, padding: '4px 24px', maxWidth: 580, margin: '0 auto 24px', textAlign: 'left', color: T.muted, fontFamily: serif, fontSize: 23, fontStyle: 'italic'}}>“Egypt is the gift of the Nile.”<div style={{fontSize: 14, fontStyle: 'normal', letterSpacing: '.14em', marginTop: 8}}>HERODOTUS</div></div>
    <div style={{fontFamily: serif, fontSize: 36, marginBottom: 24}}>Where will your curiosity take you?</div>
    <div style={{display: 'flex', justifyContent: 'center', gap: 18}}><Panel style={{padding: '17px 34px', borderColor: T.amber, fontSize: 20}}>1 YEAR TOUR</Panel><Panel style={{padding: '17px 34px', fontSize: 20, color: T.muted}}>2 YEAR TOUR</Panel></div>
    <div style={{display: 'flex', justifyContent: 'center', gap: 14, marginTop: 26}}><Tag>Name the Place</Tag><Tag>Find the Land</Tag><Tag>Revisit the Forgotten</Tag></div>
  </Panel>
</Base>;

export const MapScene = () => {
  const f = useCurrentFrame();
  const camera = interpolate(f, [0, 70, 243], [-2.5, 0.5, 1.5], {extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 1, 0.36, 1)});
  const scale = interpolate(f, [0, 243], [0.985, 1.015], {extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 1, 0.36, 1)});
  return <Base title="Name the Place." subtitle="Countries, seas, rivers—even empires light up." tag="DARK MAP  ·  REGION HIGHLIGHTS  ·  NEW">
    <Panel style={{width: 1020, height: 440, padding: 24, transform: `perspective(1400px) rotateX(3deg) rotateY(${camera}deg) scale(${scale})`}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px 20px'}}><b style={{fontFamily: serif, fontSize: 29}}>Explore the ancient world</b><Tag>NAME THE PLACE</Tag></div>
      <div style={{height: 345}}><MapArt frame={f} highlighted/></div>
    </Panel>
  </Base>;
};

export const FindScene = () => {
  const f = useCurrentFrame(); const tick = Math.min(100, Math.max(4, f * 1.25));
  return <Base title="Find the Land." subtitle="Hero names a place. You find it." tag="BEAT THE CLOCK  ·  NEW GAME MODE">
    <Panel style={{width: 950, height: 430, padding: 26}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}><b style={{fontFamily: serif, fontSize: 31}}>Find: The Nile</b><Tag>00:{Math.max(0, 30 - Math.floor(f / 5)).toString().padStart(2, '0')}</Tag></div>
      <div style={{height: 315, marginTop: 12}}><MapArt frame={f}/></div>
      <div style={{position: 'absolute', bottom: 16, left: 28, width: `${tick}%`, height: 5, background: T.green, borderRadius: 9}} />
    </Panel>
  </Base>;
};

export const ForgottenScene = () => <Base title="Lands Forgotten." subtitle="Miss a place? Hero remembers." tag="YOUR WEAK SPOTS BECOME YOUR NEXT ROUND">
  <Panel style={{width: 820, padding: 38}}><div style={{fontFamily: serif, fontSize: 33, marginBottom: 24}}>Places to revisit</div>
    {['Carthage', 'Hormuz', 'Anatolia'].map((name, i) => <div key={name} style={{display: 'flex', alignItems: 'center', gap: 20, margin: '20px 0', fontSize: 23}}><span style={{width: 170}}>{name}</span><div style={{height: 13, flex: 1, background: '#242544', borderRadius: 10}}><div style={{height: '100%', width: `${[84, 67, 46][i]}%`, background: [T.amber, T.indigo, T.violet][i], borderRadius: 10}} /></div><b style={{color: T.amber}}>{5 - i}×</b></div>)}
  </Panel>
</Base>;

export const ClioScene = () => <Base title="Meet Clio." subtitle="Your muse of history. One question away." tag="MEMORY TRICKS  ·  HISTORY CONTEXT  ·  NEW">
  <Panel style={{width: 850, padding: 32}}><div style={{textAlign: 'right', marginLeft: 175, padding: 18, borderRadius: 16, background: 'rgba(107,105,230,.2)', fontSize: 21}}>Why does the Nile matter?</div>
    <div style={{display: 'flex', gap: 18, marginTop: 25, alignItems: 'start'}}><div style={{width: 50, height: 50, borderRadius: 16, background: `linear-gradient(135deg, ${T.indigo}, ${T.amber})`, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 25}}>C</div><div style={{padding: 22, borderRadius: 17, background: 'rgba(255,255,255,.045)', fontSize: 21, lineHeight: 1.5}}>The Nile’s annual floods renewed the soil, supporting farms and cities along its banks.<div style={{color: T.amber, marginTop: 14}}>Memory trick: Nile = nourish, navigate, unite.</div></div></div>
  </Panel>
</Base>;

export const CustomsScene = () => <Base title="Make it yours." subtitle="Six colorways, four fonts, ambient space music." tag="CUSTOMS  ·  LIGHT TO DARK  ·  YOUR STUDY SPACE">
  <Panel style={{width: 1040, padding: 34}}><div style={{display: 'flex', gap: 14, justifyContent: 'center'}}>{[['Bronze','#a8692a'],['Dusk','#7c3aed'],['Ember','#ea580c'],['Moss','#16a34a'],['Coral','#e11d48'],['Graphite','#64748b']].map(([name,color])=><div key={name} style={{width: 145, height: 96, borderRadius: 16, background: color, display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700}}>{name}</div>)}</div>
    <div style={{margin: '30px auto 0', maxWidth: 680, padding: 20, borderRadius: 16, background: 'rgba(255,255,255,.04)', display: 'flex', justifyContent: 'space-between', fontSize: 21}}><span>Ambient space music</span><b style={{color: T.green}}>● ON　 ▂▅▃▆▂</b></div>
  </Panel>
</Base>;

export const MontageScene = () => <Base title="A world of discovery." subtitle="Charts. Chronicle. Scribes. Built for your phone." tag="HALL OF HEROES  ·  PRIVATE CHARTS  ·  THE CHRONICLE">
  <div style={{display: 'flex', alignItems: 'center', gap: 28}}><Panel style={{width: 500, padding: 30}}><div style={{color: T.amber, letterSpacing: '.13em', fontSize: 17}}>HALL OF HEROES</div><div style={{fontFamily: serif, fontSize: 36, margin: '20px 0'}}>A living leaderboard</div>{['01　Alexandria','02　Carthage','03　Babylon'].map((x, i) => <div key={x} style={{padding: 17, marginTop: 10, borderRadius: 13, background: 'rgba(107,105,230,.11)', fontSize: 21}}>{x}<b style={{float: 'right', color: T.amber}}>{98 - i * 3}%</b></div>)}</Panel>
    <Panel style={{width: 275, height: 420, padding: 15, transform: 'rotateY(-10deg)'}}><div style={{height: '100%', borderRadius: 20, background: '#101127', padding: 22}}><div style={{marginBottom: 28}}><Logo size={36}/></div><div style={{fontFamily: serif, fontSize: 25}}>Your next journey awaits.</div><div style={{position: 'absolute', bottom: 24, left: 25, color: T.amber, fontSize: 16}}>Map　 Heroes　 Charts　 Clio</div></div></Panel></div>
</Base>;

export const AdminScene = () => <Base admin title="For the stewards." subtitle="A different kind of control." tag="LIVE ANALYTICS  ·  FEEDBACK INBOX  ·  ONE-CLICK REDEPLOY">
  <Panel style={{width: 1040, padding: 30, background: 'rgba(16,21,30,.94)', borderColor: 'rgba(159,179,200,.24)'}}><div style={{display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${T.line}`, paddingBottom: 18, fontSize: 24}}><b>Stewards <span style={{color: T.steel}}> / Control room</span></b><span style={{color: T.green}}>● LIVE</span></div>
    <div style={{display: 'flex', gap: 14, marginTop: 22}}>{[['LIVE NOW','128'],['SESSIONS','2,418'],['COMPLETION','87%']].map(([label, value]) => <div key={label} style={{flex: 1, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, background: 'rgba(255,255,255,.025)'}}><div style={{fontSize: 14, letterSpacing: '.12em', color: T.steel}}>{label}</div><b style={{fontFamily: serif, fontSize: 38}}>{value}</b></div>)}</div>
    <div style={{display: 'flex', gap: 20, marginTop: 20}}><div style={{flex: 1, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18}}><div style={{color: T.steel, fontSize: 15}}>VISITS · LAST 14 DAYS</div><div style={{height: 120, display: 'flex', alignItems: 'end', gap: 8, marginTop: 10}}>{[28,42,35,68,54,82,61,95,70,77,100,73,89,85].map((height, i) => <i key={i} style={{height: `${height}%`, flex: 1, background: T.steel, opacity: .75, borderRadius: '5px 5px 0 0'}} />)}</div></div>
      <div style={{width: 300, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18}}><div style={{color: T.steel, fontSize: 15}}>FEEDBACK INBOX</div><p style={{fontSize: 19}}>Map marker issue</p><p style={{fontSize: 19}}>New region request</p><div style={{color: T.green}}>● 12 resolved</div></div></div>
    <div style={{marginTop: 19, fontSize: 15, letterSpacing: '.12em', color: T.steel}}>QUIZ　 CHRONICLE　 FEEDBACK　 ANALYTICS　 SITE</div>
  </Panel>
</Base>;

export const FinaleScene = () => {
  const f = useCurrentFrame();
  const spin = interpolate(f, [0, 80, 140, 179], [-12, 9, 0, 0], {extrapolateRight: 'clamp'});
  const flash = interpolate(f, [0, 4, 10], [0, 0.9, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return <SceneFrame frame={f}><Header/><AbsoluteFill style={{display: 'grid', placeItems: 'center'}}><div style={{transform: `rotateY(${spin}deg)`, textAlign: 'center'}}><div style={{display: 'flex', justifyContent: 'center'}}><Logo size={88}/></div><div style={{fontFamily: serif, fontSize: 88, fontWeight: 700, marginTop: 38}}>All new. All Hero.</div><div style={{fontFamily: serif, color: T.amber, fontSize: 34, marginTop: 16}}>Studying, redefined.</div><div style={{fontSize: 20, color: T.muted, letterSpacing: '.12em', marginTop: 20}}>WHERE HISTORY HAPPENED</div><div style={{fontFamily: sans, fontSize: 23, color: T.ink, marginTop: 32}}>heroapp.edgeone.dev</div></div></AbsoluteFill><AbsoluteFill style={{background: '#fff', opacity: flash, pointerEvents: 'none'}}/></SceneFrame>;
};
