const { chromium } = require('playwright');
const fs=require('fs');
const D=JSON.parse(fs.readFileSync('mock-data.json','utf8'));
D.stats={'agentic-engineering-loop':['40 %','faster feature delivery'],'drift-detection':['33 %','fewer UI drift fixes before release'],'hs-brand-systems':['16','web and VR products on one system']};
D.sel3=['agentic-engineering-loop','drift-detection','hs-brand-systems'];
D.cats=[['design-systems','Design systems','Tokens, components and docs serving 120+ designers and developers.'],['agentic-engineering','Agentic engineering','Agents and CI checks that turn Figma specs into consistent, shipped UI.'],['front-end-platforms','Front-end platforms','Responsive frameworks and platforms, 240+ sites built or rebuilt.'],['product-design','Product and UX design','Sprints, prototypes and web design, from idea to tested flow.'],['motion-media','Motion and media','Training media and motion for learning products.']];
D.eras=[['cobank','2023–Now','CoBank','Senior UX Engineer / Systems Lead','Agent toolkit and design system for 120+ builders; features ship 40 % faster.'],['threecolts','2023–2024','Threecolts / Onsite Support','Lead UI/UX Designer & Front-End Developer','Led UI for Amazon-seller tools; 200+ legacy sites rebuilt mobile-first.'],['health-scholars','2017–2023','Health Scholars','UI/UX Designer & Front-End Developer','One brand and UI system across 16 web and VR products.'],['independent','2015–2021','Independent','UI/UX & front-end consultant','Frameworks and design systems for startups, a museum and retailers.'],['navigators','2011–2015','The Navigators','UI Designer & Front-End Developer','40+ responsive platforms with better donation flows.'],['dli','2010–2013','Defense Language Institute','Multimedia Specialist & Front-End Designer','Mobile learning UI and 100+ training media for language training.']];
const CSS=fs.readFileSync('mock2.css','utf8');
async function prep(p){
  await p.goto('https://work.ethayer.design/',{waitUntil:'networkidle',timeout:60000});
  await p.addStyleTag({content:CSS});
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/pause motion/i.test(x.textContent));b&&b.click();});
  for(let i=0;i<30;i++){const n=await p.evaluate(()=>{scrollTo(0,document.body.scrollHeight);return document.querySelectorAll('project-card').length});if(n>=21)break;await p.waitForTimeout(400);}
  await p.evaluate(()=>scrollTo(0,0)); await p.waitForTimeout(400);
}
function build([D,dir,careerArt]){
  const mk=(t,c,txt)=>{const e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e;};
  document.documentElement.classList.add('mock-b','mock-idx');if('ghijklmnopq'.includes(dir)){document.documentElement.classList.add('v5');if(dir!=='g')document.documentElement.classList.add('v6');if('ijklmnopq'.includes(dir))document.documentElement.classList.add('v7');if('jklmnopq'.includes(dir))document.documentElement.classList.add('v8');if('klmnopq'.includes(dir))document.documentElement.classList.add('v9');if('lmnopq'.includes(dir))document.documentElement.classList.add('v10');if('mnopq'.includes(dir))document.documentElement.classList.add('v11');if('nopq'.includes(dir))document.documentElement.classList.add('v12');if('opq'.includes(dir))document.documentElement.classList.add('v13');if('pq'.includes(dir))document.documentElement.classList.add('v14');if(dir==='q')document.documentElement.classList.add('v15');dir='f';}
  // B footer on posters
  for(const card of document.querySelectorAll('project-card')){const r=D.rows.find(x=>x.slug===card.dataset.slug);const foot=card.querySelector('.poster__foot');if(!r||!foot)continue;const p=mk('p','poster__hook');p.append(mk('b',null,r.short),mk('span',null,r.hook));foot.append(p);}
  const ul=document.querySelector('view-switch ul');ul.querySelectorAll('a').forEach(a=>a.removeAttribute('aria-current'));
  const li0=mk('li');const a0=mk('a',null,'Overview');a0.href='#';a0.setAttribute('aria-current','page');li0.append(a0);ul.prepend(li0);
  const cards=Object.fromEntries([...document.querySelectorAll('project-card')].map(c=>[c.dataset.slug,c]));
  const used=new Set();const tile=(slug,cls,size)=>{const t=mk('div','tile '+cls);let c=cards[slug];if(c){if(used.has(slug))c=c.cloneNode(true);used.add(slug);c.querySelector('article').dataset.size=size;t.append(c);}return t;};
  const more=(n,label)=>{const a=mk('a','more');a.href='#';a.append(mk('b',null,'+'+n),mk('span',null,label));return a;};
  const s=mk('section','ov');const head=mk('header','ov__head');
  const T={a:['Selected work','Three projects that show how I work, with the outcome up front. Everything else is one scroll below.'],b:['What I do','Five kinds of work, the best examples of each, and the result they produced.'],c:['Career','Six roles since 2010. What I did at each, the outcome, and the work behind it.'],f:['Selected work',''],e:['Work','Three projects and their results first, then what I do, then six roles since 2010.'],d:['Work','Start with three projects and their results. Below them, six roles since 2010 and the work from each.']}[dir];
  if(dir==='f'){const src=cards['navigators-platforms'].querySelector('article');const h=mk('section','hero2');h.dataset.theme=src.dataset.theme;
    const t=mk('div','hero2__t');const top=mk('p','hero2__top');top.append(mk('span',null,'Eric Thayer'),mk('span',null,'Principal Design Engineer · Denver, CO'));
    const h1=mk('h1','hero2__h','I build design systems, ');h1.append(mk('em',null,'and the agents that ship them.'));
    const f=mk('div','hero2__f');[['23 yrs','designing and building UI, 2003–Now'],['120+','designers and developers on my systems'],['6 roles','from multimedia to systems lead']].forEach(([b,l])=>{const p=mk('p','hero2__s');p.append(mk('b',null,b),mk('span',null,l));f.append(p);});
    const cta=mk('a','hero2__cta','See selected work ↓');cta.href='#';f.append(cta);t.append(top,h1,f);
    const a=mk('div','hero2__a');const svg=src.querySelector('svg').cloneNode(true);svg.setAttribute('preserveAspectRatio','xMidYMid slice');a.append(svg);h.append(t,a);s.append(h);
    const h2=mk('h2','ov__h2','Selected work · 3 projects');const l=mk('a',null,'Résumé →');l.href='#';h2.append(l);s.append(h2);}
  else {head.append(mk('h1','ov__h1',T[0]),mk('p','ov__intro',T[1]));s.append(head);}
  if(dir==='a'||dir==='d'||dir==='e'||dir==='f'){
    const sel=mk('ul','sel');
    for(const slug of D.sel3){const r=D.rows.find(x=>x.slug===slug);const li=mk('li');li.append(tile(slug,'tall','tall'));const st=mk('div','stat');st.append(mk('span','stat__n',D.stats[slug][0]),mk('span','stat__l',D.stats[slug][1]),mk('span','stat__m',r.client+' · '+r.role));li.append(st);sel.append(li);}
    s.append(sel);
    if(dir==='a'){const w=mk('div');const h=mk('h2','ov__h2','More work · 18 projects');const a=mk('a',null,'See the full timeline →');a.href='/';h.append(a);w.append(h);
    const strip=mk('ul','strip');for(const r of D.rows){if(D.sel3.includes(r.slug))continue;const li=mk('li');li.append(tile(r.slug,'sq','sm'));strip.append(li);}w.append(strip);s.append(w);}
  }
  if(dir==='e'||dir==='f'){
    const src=cards['onsite-grid-framework'].querySelector('article');const band=mk('section','band');band.dataset.theme=src.dataset.theme;
    const t=mk('div','band__t');t.append(mk('p','band__e','What I do · 5 kinds of work'),mk('h2','band__h','What I do'),mk('p','band__p','Design systems, agentic engineering and front-end platforms, with the best example of each.'));
    const a=mk('div','band__a');const svg=src.querySelector('svg').cloneNode(true);svg.setAttribute('preserveAspectRatio','xMidYMid slice');a.append(svg);band.append(t,a);s.append(band);
  }
  if(dir==='b'||dir==='e'||dir==='f'){
    for(const [id,label,pitch] of D.cats){const rows=D.rows.filter(r=>r.cat===id);const sec=mk('section','cat');const l=mk('div','cat__l');
      l.append(mk('span','cat__n',rows.length+(rows.length===1?' project':' projects')),mk('h2','cat__h',label),mk('p','cat__p',pitch));
      const t=mk('ul','cat__t');rows.slice(0,document.documentElement.classList.contains('v15')?4:3).forEach(r=>{const li=mk('li');li.append(tile(r.slug,'sq','sm'));t.append(li);});
      if(rows.length>3){const li=mk('li');li.append(more(rows.length-3,'more '+label.toLowerCase()+' projects'));t.append(li);}
      sec.append(l,t);s.append(sec);}
  }
  if(dir==='c'||dir==='d'){
    if(dir==='d'){const h=mk('h2','ov__h2','Career · 6 roles since 2010');const a=mk('a',null,'See the full timeline →');a.href='/';h.append(a);s.append(h);}
    for(const [id,yrs,client,role,out] of D.eras){const rows=D.rows.filter(r=>r.era===id&&!(dir==='d'&&D.sel3.includes(r.slug)));const sec=mk('section','era');
      const b=mk('div','era__b');b.append(mk('h2','era__c',client),mk('p','era__r',role),mk('p','era__o',out));
      const t=mk('ul','era__t');rows.slice(0,document.documentElement.classList.contains('v15')?4:3).forEach(r=>{const li=mk('li');li.append(tile(r.slug,'sq','sm'));t.append(li);});
      if(rows.length>3){const li=mk('li');li.append(more(rows.length-3,'more'));t.append(li);}
      sec.append(mk('p','era__y',yrs),b,t);s.append(sec);}
  }
  if(dir==='e'||dir==='f'){
    if(document.documentElement.classList.contains('v9')){const src=cards[careerArt||((document.documentElement.classList.contains('v11')&&!document.documentElement.classList.contains('v12'))?'nyt-ui':'design-sprints')].querySelector('article');const band=mk('section','band band--rev');band.dataset.theme=src.dataset.theme;
      const t=mk('div','band__t');const lk=mk('a','ov__h2-link','See the full timeline →');lk.href='/';lk.className='band__l';t.append(mk('p','band__e','Career · 6 roles since 2010'),mk('h2','band__h','Career'),mk('p','band__p','From multimedia specialist to systems lead: what I did at each role and what came of it.'),lk);
      const a=mk('div','band__a');const svg=src.querySelector('svg').cloneNode(true);svg.setAttribute('preserveAspectRatio','xMidYMid slice');a.append(svg);band.append(t,a);s.append(band);}
    else {const h=mk('h2','ov__h2','Career · 6 roles since 2010');const a=mk('a',null,'See the full timeline →');a.href='/';h.append(a);s.append(h);}const rl=mk('div','roles');
    for(const [id,yrs,client,role,out] of D.eras){const n=D.rows.filter(r=>r.era===id).length;const r=mk('section','role');r.append(mk('p','role__y',yrs));const c=mk('h3','role__c',client);c.append(mk('small',null,role));const a2=mk('a','role__n',n+(n===1?' project →':' projects →'));a2.href='/';r.append(c,mk('p','role__o',out),a2);rl.append(r);}
    s.append(rl);}
  if(document.documentElement.classList.contains('v11')){
    const h1=s.querySelector('.hero2__h');if(!document.documentElement.classList.contains('v15'))h1.textContent='I build design systems, and the agents that ship them.';
    const f=s.querySelector('.hero2__f');const sum=mk('p','hero2__sum','23 years in UI. Systems used by 120+ designers and developers. Six roles, from multimedia specialist to systems lead.');f.prepend(sum);
    s.querySelectorAll('a').forEach(a=>{a.textContent=a.textContent.replace(/\s*[→↓]\s*$/,'');});
    const h2s=[...s.querySelectorAll('.ov__h2')];h2s.forEach(h=>{const a=h.querySelector('a');const t=h.firstChild;if(t&&t.nodeType===3)t.textContent=t.textContent.split(' · ')[0];});
    s.querySelectorAll('.band__e').forEach(e=>{e.textContent=e.textContent.includes('Career')?'Six roles since 2010':'Five kinds of work, 21 projects';});
    s.querySelectorAll('.stat__m').forEach(e=>{e.textContent=e.textContent.replace(' · ',', ');});
    s.querySelectorAll('.cat').forEach(c=>{const n=c.querySelector('.cat__t').children.length;const total=parseInt(c.querySelector('.cat__n').textContent);if(total>3){const a=mk('a','cat__all','See all '+total);a.href='#';c.querySelector('.cat__l').append(a);}});
    s.querySelectorAll('.role__n').forEach(a=>{a.textContent=a.textContent.replace(/\s*→/,'');});
  }
  if(document.documentElement.classList.contains('v14')){
    s.querySelectorAll('.band').forEach((b,i)=>{const t=b.querySelector('.band__t');const e=t.querySelector('.band__e');const row=mk('div','band__top');const num=mk('p','band__no');const n=b.classList.contains('band--rev')?['06_','10']:['05_','21'];num.append(n[0]);num.append(mk('br'));num.append(n[1]);row.append(mk('p','band__k',b.classList.contains('band--rev')?'2010–Now':'Capabilities'),num);
      const h=t.querySelector('.band__h');const foot=mk('div','band__foot');[...t.querySelectorAll('.band__p,.band__l')].forEach(x=>foot.append(x));if(e)foot.prepend(e);t.replaceChildren(row,h,foot);});
  }
  if(document.documentElement.classList.contains('v10')){const nar=innerWidth<=700;
    s.querySelectorAll('.hero2__a svg, .band:not(.band--rev) .band__a svg').forEach(v=>v.setAttribute('preserveAspectRatio',nar?'xMidYMax slice':'xMinYMid slice'));
    s.querySelectorAll('.band--rev .band__a svg').forEach(v=>v.setAttribute('preserveAspectRatio',nar?'xMidYMax meet':'xMaxYMid meet'));
    if(document.documentElement.classList.contains('v11'))s.querySelectorAll('.hero2__a svg,.band__a svg').forEach(v=>v.setAttribute('preserveAspectRatio',document.documentElement.classList.contains('v12')?'xMidYMid meet':'xMidYMid slice'));}
  document.querySelector('main').append(s);
}
(async()=>{
  const b=await chromium.launch();
  for(const dir of (process.argv[2]||'abc').split('')) for(const [w,h] of [[1280,800],[390,844]]){
    const ctx=await b.newContext({viewport:{width:w,height:h},bypassCSP:true,deviceScaleFactor:2});
    const p=await ctx.newPage(); await prep(p);
    await p.evaluate(build,[D,dir,process.env.CAREER_ART||null]); await p.evaluate(()=>scrollTo(0,0)); await p.waitForTimeout(800);
    await p.screenshot({path:`out2/${dir}-${w}.png`,fullPage:true});
    await ctx.close();
  }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
