import{a as e,i as t,n,r,t as i}from"./Triangle-ngAs0F_3.js";var a=`
precision highp float;
uniform sampler2D tDay, tDusk;
uniform float uP, uCanvas, uImage, uFocus;
varying vec2 vUv;
float hash(float n) { return fract(sin(n * 91.345) * 47453.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i.x + i.y * 57.), hash(i.x + 1. + i.y * 57.), f.x), mix(hash(i.x + (i.y + 1.) * 57.), hash(i.x + 1. + (i.y + 1.) * 57.), f.x), f.y); }
void main() {
  // object-fit: cover, with the same focus point as the CSS fallback
  vec2 uv = vUv;
  if (uCanvas > uImage) { float s = uImage / uCanvas; uv.y = 1. - ((1. - s) * uFocus + (1. - vUv.y) * s); }
  else { float s = uCanvas / uImage; uv.x = vUv.x * s + (1. - s) * .5; }
  vec3 day = texture2D(tDay, uv).rgb;
  vec3 dusk = texture2D(tDusk, uv).rgb;
  float lum = dot(dusk, vec3(.299, .587, .114));
  float warm = smoothstep(.10, .34, dusk.r - dusk.b) * smoothstep(.30, .58, lum) * smoothstep(.72, .6, uv.y);
  // the dusk scene with its lights still off
  vec3 unlit = mix(dusk, day * vec3(.30, .34, .54), warm);
  float n = noise(uv * vec2(5., 3.) + 3.);
  float order = mix(.42, 0., smoothstep(.35, .95, uv.y)) + n * .10;   // top of the sky first
  float tA = smoothstep(order, order + .38, uP * 1.05);
  vec3 col = mix(day, unlit, tA);
  col *= mix(vec3(1.), vec3(1.10, .97, .84), sin(clamp(uP * 1.6, 0., 1.) * 3.14159) * .55 * (1. - tA)); // golden hour on the way
  float stagger = noise(vec2(uv.x * 7., 1.5)) * .22;
  float tL = smoothstep(.58 + stagger, .66 + stagger, uP);
  col = mix(col, dusk, warm * tL);
  col = mix(col, dusk, smoothstep(.93, 1., uP)); // land exactly on the photograph
  gl_FragColor = vec4(col, 1.);
}`,o=`attribute vec2 uv; attribute vec2 position; varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 0., 1.); }`,s=e=>new Promise((t,n)=>{let r=new Image;r.decoding=`async`,r.onload=()=>t(r),r.onerror=n,r.src=e.currentSrc||e.src});async function c(c,l,u){let d=new t({canvas:c,dpr:Math.min(devicePixelRatio,1.5),antialias:!1,alpha:!1}),f=d.gl,[p,m]=await Promise.all([s(l),s(u)]),h=e=>new n(f,{image:e,generateMipmaps:!1,minFilter:f.LINEAR,wrapS:f.CLAMP_TO_EDGE,wrapT:f.CLAMP_TO_EDGE}),g=innerWidth<900?.62:.58,_=new e(f,{vertex:o,fragment:a,uniforms:{tDay:{value:h(p)},tDusk:{value:h(m)},uP:{value:0},uCanvas:{value:1},uImage:{value:m.naturalWidth/m.naturalHeight},uFocus:{value:g}}}),v=new r(f,{geometry:new i(f),program:_}),y=0,b=c.parentElement,x=()=>{let e=b.clientWidth,t=b.clientHeight;d.setSize(e,t),c.style.width=c.style.height=``,_.uniforms.uCanvas.value=e/t,S(y)};function S(e){y=e,_.uniforms.uP.value=e,d.render({scene:v})}return new ResizeObserver(x).observe(b),x(),{render:S}}export{c as createSunset};