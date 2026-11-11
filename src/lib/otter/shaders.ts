/**
 * 封面那只海獭的两段着色器。
 *
 * 第一段（SCENE）是一台小小的「照相机」，对着一只用距离场捏出来的海獭做光线步进：
 *   · 先捏出「皮」：身子、头、四肢、尾巴，都是椭球和胶囊圆滑地并在一起。
 *     它得像海獭、而不是小熊，靠的是这几样：头是又宽又扁又长的一块（宽 : 长 : 高 ≈ 1 : 1 : 0.6），不是球，
 *     脸最宽的地方是垂在两边的腮；口鼻是一整块往前鼓的钝垫子，额头顺着它滑下来，没有「额头 — 鼻梁」的台阶；
 *     鼻子是口鼻最前头又宽又黑的一大块；眼睛小、分得开，在口鼻根的两个角上；耳朵很小、深色，长在头的两侧、
 *     远在眼睛后面，不在头顶；没有脖子，身子是长长的一根；前肢短，爪子像连指手套；后脚是翘出水面的扇形脚蹼；
 *     尾巴是一片扁桨。它抬着头、脸朝自己的脚，镜头从斜上方看：额头在上、五官挤在下半张脸。改造型的时候别把这些弄丢。
 *     像了还得可爱、不能是不高兴的样子，但也别用力过度：眼睛要朝前（靠口鼻根两边垫起来的眼眶），是两颗略竖的、
 *     里面有一点光的小黑豆，不能是长在斜坡上的两道耷拉的缝，也不要画粗眼线；嘴是鼻尖底下浅浅的一道，两头略微一收，
 *     既不往下撇成「人」字，也不往上翘成大大的「ω」；头上和肚皮上的毛是匀净的短绒，腮上蓬一些。
 *   · 皮外面套一层薄薄的壳，壳里是毛：视线穿过这层壳的时候一小步一小步地采样，
 *     每一步问一句「这里有没有一根毛」—— 毛根密、毛梢疏，毛根暗、毛梢亮。
 *     所以毛是一根一根的，轮廓是绒的，而不是在表面上鼓几个包。
 *   · 眼睛、鼻子、石头不长毛，是硬的；眼睛周围和嘴上的毛剪得很短，不会把它们盖住。
 * 姿势（头怎么转、爪子在哪、石头飞到哪了）全部由 renderer.ts 算好传进来，这里只管画。
 *
 * 第二段（PRINT）是一台「印刷机」：把上面那张照片分成黑、蓝两块版，各自套上一层网点印到纸上
 * （也可以换成字符、有序抖动，或者干脆不印、直接看照片）。胡须在这一步描：它们是空间里真的
 * 几根线，和照片里记下来的深度比过，被头挡住的那一截不会画出来。
 */

/** 一个盖满画面的三角形，不需要顶点数据 */
export const VERT = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const SCENE_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  uRes;       // 这张「照片」的分辨率
uniform float uTime;
uniform vec2  uCenter;    // 海獭落在画面的哪里（0–1，原点在左下）
uniform float uZoom;      // 焦距：越大，它在画面里越大
uniform float uDark;      // 0 浅色主题，1 深色主题
uniform float uLift;      // 页面往下滚的时候镜头升高一点
uniform vec4  uRip[6];    // 点出来的涟漪：xz、开始的时间、强度
uniform vec4  uShy;       // 给文字让路：水面在画面的 (x0→x1)、(y0→y1) 之间才渐渐显出来（0–1，原点在左上）

// 姿势。坐标都是它自己的：身子顺着 x 轴，头在 +x 那一头，y 朝上
uniform vec4  uBody;      // 起伏、侧倾、尾巴的摆动、脚蹼的摆动
uniform vec3  uHead;      // 头的中心
uniform mat3  uHeadRot;   // 头的三个方向（三列）：脸朝哪、头顶朝哪、侧面
uniform vec3  uElbow;     // 右前肢的肘（左边是镜像）
uniform vec3  uPaw;       // 右爪
uniform vec3  uStone;     // 石头的中心
uniform mat3  uStoneRot;  // 石头转成了什么样
uniform float uBlink;     // 眼皮合上多少（0 睁 … 1 闭）

layout(location = 0) out vec4 oColor; // 颜色；alpha = 这一点留多少（往四周淡出到纸面）
layout(location = 1) out vec4 oPlate; // 分色：r 明度，g 蓝版，b 是不是石头，a 深度

const vec3  SUN = vec3(-0.5571, 0.7597, 0.3350); // 光从左上方、稍微靠近镜头的地方来
const float YAW = -0.95;   // 它在水面上的朝向：脚冲着镜头，头在远处偏右 —— 这样脸是正的
const float FUR = 0.056;   // 最长的毛有多长
const float NEAR = 2.6;    // 深度是从这里到 NEAR + DEPTH 之间记的
const float DEPTH = 2.8;

// ── 小工具 ────────────────────────────────────────────────

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// 圆滑地并在一起：k 越大，接缝越软（像捏泥）
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  if (k0 < 1.0) return (k0 - 1.0) * min(min(r.x, r.y), r.z);
  return k0 * (k0 - 1.0) / length(p / (r * r));
}

// 两头粗细可以不一样的胶囊
float sdLimb(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(r1, r2, h);
}

float segDist(vec3 p, vec3 a, vec3 b) {
  vec3 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// ── 海獭 ──────────────────────────────────────────────────

// 世界 → 它自己的身子
vec3 toBody(vec3 p) {
  p.xz = rot(YAW) * p.xz;
  p.y -= uBody.x;
  p.yz = rot(uBody.y) * p.yz;
  return p;
}

// 身子 → 头自己的坐标（x 脸朝前，y 头顶，z 侧面）。头上的尺寸都是按 1 写的，整体再放大 HEAD_S 倍
const float HEAD_S = 1.13;
vec3 toHead(vec3 b) {
  return (b - uHead) * uHeadRot / HEAD_S;
}

// 头上的东西都在头自己的坐标里定位（x 脸朝前，y 头顶，z 侧面）。
// 头是照着海獭的头捏的：又宽又扁又长的一块鹅卵石（宽 : 长 : 高 ≈ 1 : 1 : 0.6），不是球。
// 它抬着头、脸朝自己的脚，镜头从斜上方看过去：额头占了上半张脸，眼睛在正中，鼻子和嘴挤在下面
const vec3 SKULL_C = vec3(-0.04, 0.0, 0.0);     // 脑壳：扁的，前面是一个又高又光的大脑门
const vec3 SKULL_R = vec3(0.18, 0.16, 0.215);
const vec3 JOWL = vec3(0.05, -0.09, 0.137);     // 腮：脸最宽的地方在这里，比眼睛低，一直垂到嘴那么低
const vec3 MUZZLE = vec3(0.115, -0.03, 0.0);    // 口鼻：又宽又钝的一整块，从两眼之间一直伸到鼻尖，额头顺着它滑下来
const vec3 ORBIT = vec3(0.064, 0.024, 0.118);   // 眼眶：口鼻根两边各垫起来的一小块，让眼睛朝前看。
//                                                 没有它，眼睛是长在朝天的斜坡上的，从前面看被压成两道往外耷拉的斜缝 —— 一脸不高兴
const vec3 PAD = vec3(0.172, -0.07, 0.058);     // 胡须垫：口鼻前面鼓出来的两团，盖在下巴前头
const vec3 PAD_R = vec3(0.06, 0.068, 0.062);
const vec3 CHIN = vec3(0.17, -0.125, 0.0);      // 下巴：比胡须垫往后缩一点
const vec3 EYE = vec3(0.1248, 0.0207, 0.1101);  // 眼睛：两颗竖着的小黑豆，分得很开，长在口鼻根的两个角上
const float EYE_R = 0.022;
const vec3 EYE_K = vec3(1.0, 0.8, 1.0);         // 眼睛比圆的略高一点
const vec3 NOSE = vec3(0.213, -0.014, 0.0);     // 鼻子：口鼻最前头、朝着前上方的一大块黑皮垫
const float MOUTH_Y = -0.082;                   // 人中到这里为止，嘴从这里往两边走
const vec3 EAR_A = vec3(-0.1, -0.015, 0.2);     // 耳朵：从头的侧面、远在眼睛后面伸出去的一小片（根 → 尖）
const vec3 EAR_B = vec3(-0.115, 0.008, 0.272);
// 身上的
const vec3 SHOULDER = vec3(0.22, 0.11, 0.205);
const vec3 ANKLE = vec3(-0.75, 0.07, 0.165);
// 脚蹼自己的三个方向（三列）：脚底板朝哪（朝脚那一头）、脚趾朝哪（朝天，往外撇，往头这边收一点）、横向
const mat3 FOOT = mat3(-0.9725, 0.2313, 0.0279, 0.2246, 0.8985, 0.3774, 0.0622, 0.3733, -0.9258);

// 脚蹼：翘出水面的两把扇子，又长又扁 —— 是鳍，不是带肉垫的脚掌。s 是折到一边的身子坐标
float sdFoot(vec3 s) {
  vec3 fp = (s - ANKLE) * FOOT;
  fp.xy = rot(uBody.w) * fp.xy;
  vec3 ft = vec3(fp.x, fp.y, abs(fp.z));
  // 蹼：一片薄薄的扇面，尖在脚踝，往趾尖张开（半个张角 17°）
  const vec2 c = vec2(0.2924, 0.9563);
  vec2 p2 = vec2(ft.z, ft.y);
  float pie = max(length(p2) - 0.3, length(p2 - c * clamp(dot(p2, c), 0.0, 0.3)) * sign(c.y * p2.x - c.x * p2.y));
  vec2 w = vec2(pie, abs(ft.x) - 0.004);
  float foot = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.009;
  // 五根脚趾：细长的五道棱，从脚踝一直撑到扇面的边上，中间那根最长
  foot = smin(foot, sdLimb(ft, vec3(0.0, 0.04, 0.0), vec3(0.0, 0.315, 0.0), 0.02, 0.014), 0.012);
  foot = smin(foot, sdLimb(ft, vec3(0.0, 0.04, 0.005), vec3(0.0, 0.305, 0.04), 0.02, 0.014), 0.012);
  return smin(foot, sdLimb(ft, vec3(0.0, 0.04, 0.01), vec3(0.0, 0.285, 0.076), 0.02, 0.013), 0.012);
}

float sdEar(vec3 qs) {
  return sdLimb(qs, EAR_A, EAR_B, 0.026, 0.017);
}

// 头的皮（头自己的坐标，放大之前的尺寸）
float sdHeadSkin(vec3 q) {
  vec3 qs = vec3(q.x, q.y, abs(q.z));
  float h = sdEllipsoid(q - SKULL_C, SKULL_R);
  h = smin(h, sdEllipsoid(qs - JOWL, vec3(0.14, 0.085, 0.108)), 0.05);
  h = smin(h, sdEllipsoid(q - MUZZLE, vec3(0.1, 0.085, 0.11)), 0.05);
  h = smin(h, length(qs - ORBIT) - 0.05, 0.03);
  h = smin(h, sdEllipsoid(qs - PAD, PAD_R), 0.03);
  h = smin(h, sdEllipsoid(q - CHIN, vec3(0.046, 0.036, 0.07)), 0.03);
  return smin(h, sdEar(qs), 0.02);
}

// 皮：毛底下的身子
float sdSkin(vec3 b, vec3 q) {
  vec3 s = vec3(b.x, b.y, abs(b.z));   // 左右对称的部件：把 z 折过来只算一边
  vec3 qs = vec3(q.x, q.y, abs(q.z));

  // 身子：胸、肚子、胯连成长长的一条，粗细差不多 —— 海獭是一根圆滚滚的管子，没有肩膀也没有腰
  float d = sdEllipsoid(b - vec3(-0.08, -0.02, 0.0), vec3(0.56, 0.21, 0.25));
  d = smin(d, sdEllipsoid(b - vec3(0.30, 0.02, 0.0), vec3(0.30, 0.2, 0.235)), 0.16);
  d = smin(d, sdEllipsoid(b - vec3(-0.50, -0.03, 0.0), vec3(0.28, 0.185, 0.23)), 0.16);
  // 脖子：又短又粗，从胸口接到后脑勺底下（不是接到头的正中 —— 头是扁的，那样脖子会从脸上顶出来）。头往哪转，它跟到哪
  d = smin(d, sdLimb(b, vec3(0.42, 0.04, 0.0), uHead - 0.11 * uHeadRot[0] - 0.07 * uHeadRot[1], 0.2, 0.15), 0.12);
  // 尾巴：又宽又扁的一片桨，根上和腿差不多宽，往后慢慢收窄，贴着水面摆
  vec3 tp = b - vec3(-0.72, 0.0, 0.0);
  tp.xz = rot(0.22 + uBody.z) * tp.xz;
  float tw = mix(1.0, 0.62, smoothstep(-0.08, -0.42, tp.x));
  d = smin(d, sdEllipsoid(vec3(tp.x + 0.2, tp.y, tp.z / tw), vec3(0.23, 0.05, 0.11)) * tw, 0.1);
  // 后腿：短短的一截，藏在胯两边
  d = smin(d, sdEllipsoid(s - vec3(-0.60, 0.015, 0.165), vec3(0.17, 0.125, 0.105)), 0.13);
  d = smin(d, sdFoot(s), 0.05);
  // 前肢：肩 → 肘 → 爪，又短又粗。两节骨头的长度是定死的，肘的位置由肩和爪倒推（见 renderer.ts）
  d = smin(d, sdLimb(s, SHOULDER, uElbow, 0.06, 0.05), 0.08);
  d = smin(d, sdLimb(s, uElbow, uPaw, 0.048, 0.042), 0.035);
  d = smin(d, sdEllipsoid(s - uPaw, vec3(0.058, 0.044, 0.05)), 0.03);   // 爪子：没有分开的指头，像戴着连指手套

  return smin(d, sdHeadSkin(q) * HEAD_S, 0.1);
}

// 鼻子自己的坐标：原点在鼻子正中，往后仰了一点
vec3 noseLocal(vec3 q) {
  vec3 np = q - NOSE;
  np.xy = rot(0.26) * np.xy;
  return np;
}

// 不长毛的东西。返回 (距离, 材质)：1 石头，2 眼睛，3 鼻子
vec2 sdHard(vec3 b, vec3 q) {
  vec3 qs = vec3(q.x, q.y, abs(q.z));
  // 眼睛：一颗略竖的小黑豆，有一半露在外面。眼皮是一个从上往下合的平面，合上的部分就露出后面的毛
  float lid = EYE.y + EYE_R / EYE_K.y * (1.0 - 2.0 * uBlink);
  vec2 res = vec2(max(length((qs - EYE) * EYE_K) - EYE_R, q.y - lid) * HEAD_S, 2.0);
  // 鼻子：一块厚厚的黑皮垫，上沿往后仰。顶上窄而圆，往下越来越宽，是个大头朝下的圆角三角
  vec3 np = noseLocal(q);
  float nk = mix(0.6, 1.06, smoothstep(0.95, -0.35, np.y / 0.047));
  np.z /= nk;
  float nose = sdEllipsoid(np, vec3(0.036, 0.047, 0.072)) * min(nk, 1.0) * HEAD_S;
  if (nose < res.x) res = vec2(nose, 3.0);
  // 石头：一块磨圆了的扁卵石，是刚体 —— 只会平移和转动
  float st = sdEllipsoid((b - uStone) * uStoneRot, vec3(0.108, 0.064, 0.09));
  if (st < res.x) res = vec2(st, 1.0);
  return res;
}

// 这一处的毛有多长。y 是这一点离水面多高：贴着水的毛是湿的、塌的；skin 是这一点离皮多远。
// 脚蹼和耳朵几乎是光的。它们不按「离得近不近」算，而是问「离这一点最近的那块皮是不是它」——
// 不然它们外面一圈本该没毛的地方，会按身上的毛长飘出一团碎毛
float furLength(vec3 b, vec3 q, float y, float skin) {
  vec3 s = vec3(b.x, b.y, abs(b.z));
  vec3 qs = vec3(q.x, q.y, abs(q.z));
  float len = 0.052;                                                        // 身上
  float onHead = smoothstep(0.42, 0.27, length(q));
  len = mix(len, 0.03, onHead);                                             // 头顶、额头：短而匀的一层绒，看得出头的形
  len = mix(len, 0.046, onHead * smoothstep(0.2, 0.07, length(qs - vec3(0.02, -0.1, 0.18))));    // 腮：蓬一些
  len = mix(len, 0.011, smoothstep(0.17, 0.11, length((q - vec3(0.16, -0.06, 0.0)) / vec3(1.0, 1.0, 1.3)))); // 口鼻：最短
  len = mix(len, 0.004, smoothstep(0.058, 0.03, length(qs - EYE)));         // 眼睛周围：不能盖住眼睛
  len = mix(len, 0.007, smoothstep(0.022, 0.006, sdEar(qs) * HEAD_S - skin)); // 耳朵：才从毛里露得出来
  len = mix(len, 0.012, smoothstep(0.1, 0.055, length(s - uPaw)));          // 爪子
  len = mix(len, 0.03, smoothstep(-0.7, -0.82, b.x));                       // 尾巴：短而顺
  len = mix(len, 0.007, smoothstep(0.022, 0.006, sdFoot(s) - skin));        // 脚蹼
  return len * (0.4 + 0.6 * smoothstep(-0.02, 0.1, y));
}

// 朝天那一面的中间（胸口、肚子）是一整片浅色，和参考的模型一样；两侧、四肢、胯和尾巴是深的。边上是渐变
float bibMask(vec3 b) {
  return smoothstep(0.03, 0.17, b.y) * smoothstep(0.2, 0.08, abs(b.z)) * smoothstep(-0.6, -0.2, b.x);
}

// 毛色：脸是奶油色，头顶和喉咙是沙色，往肚子一路变成深褐 —— 海獭年纪越大头越白。还有嘴、眼线这些画在毛上的东西
vec3 furColor(vec3 b, vec3 q) {
  vec3 s = vec3(b.x, b.y, abs(b.z));
  vec3 qs = vec3(q.x, q.y, abs(q.z));
  vec3 dark = vec3(0.165, 0.098, 0.058);
  vec3 belly = vec3(0.62, 0.46, 0.32);
  vec3 pale = vec3(0.59, 0.435, 0.3);
  vec3 cream = vec3(0.73, 0.555, 0.39);
  vec3 c = mix(dark, belly, bibMask(b));
  float head = smoothstep(0.2, 0.0, sdEllipsoid(q - SKULL_C, SKULL_R * 1.25));
  float throat = smoothstep(0.5, 0.12, length((b - vec3(0.5, 0.2, 0.0)) / vec3(1.0, 0.8, 1.0)));
  c = mix(c, pale, max(head, throat * 0.9));
  float face = smoothstep(0.4, 0.14, length((q - vec3(0.1, -0.04, 0.0)) / vec3(1.0, 0.95, 1.15)));
  c = mix(c, cream, face);
  // 前肢和身上一样深，在浅色的胸口上才看得出那是两只小手；爪子、耳朵、脚蹼、尾巴更深
  float arm = smoothstep(0.09, 0.05, min(segDist(s, SHOULDER, uElbow), segDist(s, uElbow, uPaw)));
  c = mix(c, dark, 0.85 * arm);
  float paw = smoothstep(0.1, 0.055, length(s - uPaw));
  float ear = smoothstep(0.02, 0.006, sdEar(qs)) * smoothstep(0.208, 0.232, qs.z);
  c = mix(c, vec3(0.13, 0.085, 0.06), paw);
  c = mix(c, vec3(0.05, 0.036, 0.03), ear);
  c = mix(c, dark * 0.8, smoothstep(-0.7, -0.82, b.x));
  c = mix(c, vec3(0.062, 0.044, 0.037), smoothstep(0.024, 0.008, sdFoot(s)));
  // 嘴：鼻尖底下一小段人中，再往两边各走一道浅浅的弧 —— 先朝外下方，到头略微一收，越往外越淡。嘴角不往上翘
  float mz = qs.z;
  float my = MOUTH_Y - 0.2 * mz - 0.018 * sin(3.1416 * clamp(mz / 0.085, 0.0, 1.0));
  float lip = smoothstep(0.009, 0.0035, abs(q.y - my)) * (1.0 - smoothstep(0.07, 0.09, mz)) * (1.0 - 0.55 * smoothstep(0.035, 0.08, mz));
  float philtrum = smoothstep(0.006, 0.002, mz) * step(q.y, NOSE.y - 0.04) * step(MOUTH_Y, q.y);
  c = mix(c, vec3(0.13, 0.09, 0.07), max(lip, philtrum) * step(0.15, q.x));
  // 眼线：贴着眼睛的窄窄一圈深色短毛；眼皮合上的时候只剩一道往上弯的线
  float eyeD = length((qs - EYE) * EYE_K);
  float dz = qs.z - EYE.z;
  float rim = 0.75 * smoothstep(EYE_R + 0.009, EYE_R + 0.002, eyeD);
  // （眼睛长在往两侧转过去的面上，从斜上方看，一条水平的线会变成外高内低，像在瞪人；所以让它往外低一点，看上去才是平的）
  float seam = smoothstep(0.007, 0.003, abs(q.y - EYE.y + 0.5 * EYE_R - 9.0 * dz * dz + 0.35 * dz)) * smoothstep(EYE_R + 0.01, EYE_R + 0.001, eyeD);
  c = mix(c, vec3(0.15, 0.1, 0.075), 0.9 * mix(rim, seam, uBlink) * step(0.04, q.x));
  // 胡须的毛孔：胡须垫上几排小黑点
  vec2 pad = vec2(q.y - PAD.y, abs(q.z) - PAD.z);
  float pores = smoothstep(0.22, 0.12, length(fract(pad * 62.0) - 0.5)) * smoothstep(0.046, 0.026, length(pad - vec2(0.012, 0.016))) * step(0.19, q.x);
  return mix(c, vec3(0.2, 0.14, 0.1), 0.55 * pores);
}

float mapSolid(vec3 p) {
  vec3 b = toBody(p);
  vec3 q = toHead(b);
  return min(sdSkin(b, q), sdHard(b, q).x);
}

// 软阴影：一路朝着光走过去，看擦着别的东西有多近
float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.04;
  for (int i = 0; i < 18; i++) {
    float h = mapSolid(ro + rd * t);
    res = min(res, 7.0 * h / t);
    t += clamp(h, 0.03, 0.14);
    if (res < 0.004 || t > 1.7) break;
  }
  return clamp(res, 0.0, 1.0);
}

// ── 水 ────────────────────────────────────────────────────

float ripple(vec2 p, float t) {
  // 一直都有的细浪
  float h = 0.012 * sin(p.x * 5.1 + t * 1.1 + sin(p.y * 3.3)) + 0.009 * sin(p.y * 6.7 - t * 0.9 + p.x * 2.1);
  // 以它的身子为中心荡开的一圈圈
  float r = length((rot(YAW) * p - vec2(-0.06, 0.0)) / vec2(1.0, 0.66));
  h += 0.02 * sin(r * 17.0 - t * 2.6) * exp(-max(r - 0.55, 0.0) * 1.6) * smoothstep(0.5, 0.75, r);
  // 点出来的涟漪：一个往外走的环
  for (int i = 0; i < 6; i++) {
    vec4 rp = uRip[i];
    float age = t - rp.z;
    if (rp.w <= 0.0 || age < 0.0 || age > 4.5) continue;
    float d = length(p - rp.xy) - age * 0.55;
    h += rp.w * 0.036 * sin(d * 30.0) * exp(-d * d * 26.0) * exp(-age * 0.85);
  }
  return h;
}

vec2 hitSphere(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 oc = ro - c;
  float b = dot(oc, rd), h = b * b - dot(oc, oc) + r * r;
  if (h < 0.0) return vec2(1.0, -1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

float tone(vec3 c) { return pow(clamp(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 1.0), 0.4545); }
// 毛印得比别的东西浅一档：不然深色的身子印出来是一整块黑，看不出毛，头也不够白
float furTone(vec3 c) { return pow(clamp(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 1.0), 0.3); }

void main() {
  float t = uTime;

  // 镜头：从它脚这一头的上方往下看；长焦，透视压得平一点
  vec2 uv = (gl_FragCoord.xy - uRes * uCenter) / uRes.y;
  vec3 ta = vec3(-0.07, 0.06, 0.098);
  vec3 ro = ta + vec3(-0.85, 2.55 + uLift, 2.65);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + uZoom * ww);
  float tWater = rd.y < 0.0 ? -ro.y / rd.y : 1e5;

  // 光在它自己坐标里的方向（它在水面上转过一个角度，还会侧倾）
  vec3 sunB = SUN;
  sunB.xz = rot(YAW) * sunB.xz;
  sunB.yz = rot(uBody.y) * sunB.yz;
  vec3 rdB = rd;
  rdB.xz = rot(YAW) * rdB.xz;
  rdB.yz = rot(uBody.y) * rdB.yz;

  // ── 第一步：走到毛的最外沿（或者直接碰到硬的东西）
  vec4 fur = vec4(0.0);          // 一路攒下来的毛：颜色（已经乘过不透明度）和不透明度
  float furLight = 0.0;          // 同样攒下来的明度，分色用
  float depth = tWater;          // 这条视线上最先碰到东西的地方
  float stone = 0.0, blue = 0.0;
  bool solid = false;            // 是不是已经被实心的东西挡死了
  vec3 solidCol = vec3(0.0);
  float solidLight = 0.0;

  vec2 bs = hitSphere(ro, rd, vec3(-0.07, 0.08, 0.098), 1.24);   // 包住整只海獭的球：它的中点在身子上偏尾巴一点
  if (bs.x < bs.y) {
    float tt = max(bs.x, 0.0);
    // 一条视线可能先后穿过好几处毛（比如先擦过下巴，再落到胸口上）：穿出去没被挡死的话，接着往前走
    for (int visit = 0; visit < 6; visit++) {
    bool inShell = false;
    for (int i = 0; i < 64; i++) {
      vec3 b = toBody(ro + rd * tt);
      vec3 q = toHead(b);
      float d = min(sdSkin(b, q) - FUR, sdHard(b, q).x);
      if (d < 0.0015) { inShell = true; break; }
      tt += d * 0.9;
      if (tt > bs.y || tt > tWater) break;
    }

    if (!inShell) break;
    {
      // 进壳那一刻算一次：皮的朝向（毛顺着它长）、有没有被别的部位挡住光
      vec3 p0 = ro + rd * tt;
      vec3 b0 = toBody(p0);
      const vec2 e = vec2(1.0, -1.0) * 0.004;
      vec3 n = normalize(
        e.xyy * sdSkin(b0 + e.xyy, toHead(b0 + e.xyy)) + e.yyx * sdSkin(b0 + e.yyx, toHead(b0 + e.yyx)) +
        e.yxy * sdSkin(b0 + e.yxy, toHead(b0 + e.yxy)) + e.xxx * sdSkin(b0 + e.xxx, toHead(b0 + e.xxx)));
      float sh = softShadow(p0 + SUN * 0.02, SUN);
      float ndl = dot(n, sunB);
      float dif = clamp(ndl * 0.62 + 0.38, 0.0, 1.0);       // 把光往背面「包」过去：毛是透光的
      float sky = 0.5 + 0.5 * n.y;
      float ndv = clamp(dot(n, -rdB), 0.0, 1.0);
      float sheen = pow(clamp(dot(n, normalize(sunB - rdB)), 0.0, 1.0), 12.0);
      // 毛被梳向尾巴、又往下垂：越靠近毛梢偏得越多
      // 毛往哪边倒：身上的被梳向尾巴、又往下垂；头上的从鼻子往后脑勺倒（跟着头走），不然额头的毛会倒下来盖住眼睛
      vec3 comb = length(toHead(b0)) < 0.36 ? uHeadRot * vec3(-1.0, -0.2, 0.0) : vec3(-1.0, -0.55, 0.0);
      comb = normalize(comb - n * dot(comb, n) + 1e-4);

      // ── 第二步：在壳里一小步一小步地走，问每一步「这里有没有毛」
      for (int i = 0; i < 40; i++) {
        vec3 p = ro + rd * tt;
        if (tt > tWater) break;
        vec3 b = toBody(p);
        vec3 q = toHead(b);
        float s = sdSkin(b, q);
        vec2 hd = sdHard(b, q);

        if (hd.x < 0.002) {
          // 碰到硬的东西：眼睛、鼻子、石头
          const vec2 f = vec2(1.0, -1.0) * 0.0015;
          vec3 hn = normalize(
            f.xyy * sdHard(b + f.xyy, toHead(b + f.xyy)).x + f.yyx * sdHard(b + f.yyx, toHead(b + f.yyx)).x +
            f.yxy * sdHard(b + f.yxy, toHead(b + f.yxy)).x + f.xxx * sdHard(b + f.xxx, toHead(b + f.xxx)).x);
          vec3 alb; float spec, gloss;
          if (hd.y > 2.5) { alb = vec3(0.028, 0.025, 0.026) * (0.7 + 0.6 * noise3(q * 190.0)); spec = 0.5 * noise3(q * 260.0 + 3.0); gloss = 22.0; } // 鼻子：糙的湿皮
          else if (hd.y > 1.5) { alb = vec3(0.02, 0.014, 0.012); spec = 2.3; gloss = 64.0; }    // 眼睛：又黑又亮，里面有一点光
          else {                                                                                 // 石头：克莱因蓝
            vec3 sp = (b - uStone) * uStoneRot;
            alb = vec3(0.0, 0.165, 0.64) * (0.86 + 0.28 * noise3(sp * 40.0));
            spec = 0.6; gloss = 52.0;
          }
          float hdif = clamp(dot(hn, sunB) * 0.8 + 0.2, 0.0, 1.0);
          float hsh = softShadow(p + SUN * 0.02, SUN);
          float hl = pow(clamp(dot(hn, normalize(sunB - rdB)), 0.0, 1.0), gloss);
          if (hd.y > 1.5 && hd.y < 2.5) hsh = max(hsh, 0.65);        // 眼睛里的高光不全靠太阳：天光也映得进去
          float shade = clamp(0.95 * hdif * hsh + 0.3 * (0.5 + 0.5 * hn.y) + hl * spec * hsh, 0.0, 1.4);
          solidCol = alb * (1.35 * hdif * hsh * vec3(1.0, 0.96, 0.9) + 0.36 * (0.5 + 0.5 * hn.y) * vec3(0.9, 0.95, 1.0)) + hl * spec * hsh;
          solidCol = 1.0 - exp(-solidCol * 1.35);
          solidLight = tone(solidCol);
          // 印的时候眼睛就是两颗实心的黑豆：高光留给原片，不然网点会把它印成一个空心的圈
          if (hd.y > 1.5 && hd.y < 2.5) solidLight = min(solidLight, 0.22);
          if (hd.y < 1.5) {
            stone = 1.0 - fur.a;
            solidLight = clamp(shade * 0.82, 0.0, 1.0);
            // 蓝版：浅色主题下暗处印满、亮处留白；深色主题下反过来，亮处才有光
            blue = stone * mix(1.0 - 0.8 * smoothstep(0.6, 1.2, shade), 0.22 + 0.78 * smoothstep(0.1, 1.0, shade), uDark);
          }
          solid = true;
          if (fur.a < 0.5) depth = tt;
          break;
        }

        float len = furLength(b, q, p.y, s);
        if (s < 0.0025) {
          // 毛根底下的皮。毛长的地方它是一层很暗的底绒；毛剪得很短的地方（脚蹼、尾巴、嘴上）它就是看得见的表面
          float bare = 1.0 - smoothstep(0.008, 0.04, len);
          solidCol = furColor(b, q) * mix(length(q) < 0.36 ? 0.62 : 0.34, 1.0, bare) * (0.35 + 0.95 * dif * sh);
          solidCol = 1.0 - exp(-solidCol * 1.35);
          solidLight = furTone(solidCol);
          solid = true;
          if (fur.a < 0.5) depth = tt;
          break;
        }

        float step_ = clamp(s * 0.35, 0.0035, 0.012);
        if (s < len) {
          float h = s / len;                                   // 0 毛根 … 1 毛梢
          // 头上的毛是干的：细、密、蓬着。身上的是湿的：倒得更平，粘成顺着身子的一绺一绺，长短差得多
          bool onHead = length(q) < 0.36;
          // 这一点的毛，根在皮上的哪里：顺着法线退回去，再把「梳」出去的那一段减掉
          vec3 off = n * s + comb * h * h * len * (onHead ? 0.9 : 1.5);
          vec3 root = b - off;
          // 头上的毛跟着头走：在头自己的坐标里认毛，不然头一转、毛却留在原地
          vec3 rk = onHead ? q + 7.0 - off * uHeadRot / HEAD_S : root;
          float clump = noise3(rk * (onHead ? vec3(30.0) : vec3(12.0, 34.0, 34.0)));   // 一撮一撮的：每撮长短不一样
          float hh = h / (onHead ? 0.84 + 0.32 * clump : 0.5 + 0.9 * clump);          // 头上的长短差得少：是匀净的一层
          float strand = noise3(rk * (onHead ? vec3(250.0) : vec3(110.0, 190.0, 190.0)));
          float thin = onHead ? 0.56 : 0.8;                    // 头上的毛梢密一些：是一层绒，不是一根根支棱着的刺
          float dens = hh < 1.0 ? smoothstep(mix(0.26, thin, hh), mix(0.4, thin + 0.1, hh), strand) : 0.0;
          if (dens > 0.001) {
            vec3 alb = furColor(root, toHead(root)) * (0.82 + 0.36 * noise3(rk * 60.0));
            float paleness = smoothstep(0.25, 0.7, dot(alb, vec3(0.333)));
            // 毛根暗，毛梢亮；浅色的毛根也浅。头上和肚皮上的毛根不压那么暗：看上去是匀净的绒，不是一粒一粒的
            float soft = onHead ? 1.0 : bibMask(root);
            vec3 c = mix(alb * mix(mix(0.42, 0.7, paleness), 0.84, soft), alb * 1.3 + 0.04, hh);
            float occ = mix(mix(mix(0.28, 0.5, paleness), 0.68, soft), 1.0, hh * hh);  // 毛丛深处照不到光
            vec3 lit = c * (1.3 * dif * sh * occ * vec3(1.0, 0.96, 0.9) + 0.38 * sky * occ * vec3(0.9, 0.95, 1.0));
            // 逆着视线看过去的边上，毛梢被光打亮的一圈
            lit += c * 0.55 * pow(1.0 - ndv, 2.5) * hh * (0.3 + 0.7 * clamp(ndl * 0.5 + 0.5, 0.0, 1.0));
            // 湿毛上的一层水光：只在身上，一绺一绺地亮
            lit += vec3(0.5, 0.47, 0.42) * sheen * sh * hh * clump * (1.0 - soft);
            lit = 1.0 - exp(-lit * 1.35);
            float a = dens * (1.0 - exp(-step_ * 210.0)) * (1.0 - fur.a);
            fur.rgb += lit * a;
            // 印的时候轮廓边上压深一点：浅色的头印在浅色的纸上，才有一圈看得见的边
            furLight += furTone(lit) * (1.0 - 0.24 * pow(1.0 - ndv, 1.5)) * a;
            if (fur.a < 0.5 && fur.a + a >= 0.5) depth = tt;
            fur.a += a;
          }
        }
        tt += step_;
        if (fur.a > 0.985) break;
        if (s > FUR + 0.003 && i > 3) break;
        if (tt > bs.y) break;
      }
    }
    if (solid || fur.a > 0.985 || tt > bs.y || tt > tWater) break;
    }
  }

  // ── 第三步：毛后面是什么。要么是刚才碰到的实心的东西，要么是水
  vec3 back;
  float backLight, keep;
  if (solid) {
    back = solidCol;
    backLight = solidLight;
    keep = 1.0;
  } else {
    // 水面。先算这一点最后会留多少：离它越远，水越接近一张白纸；有文字的那一边也让开
    vec3 pw = ro + rd * tWater;
    vec2 xz = pw.xz;
    vec2 sp = gl_FragCoord.xy / uRes;
    keep = 1.0 - smoothstep(0.9, 2.3, length((rot(YAW) * xz - vec2(-0.1, 0.0)) / vec2(1.3, 1.05)));
    keep *= smoothstep(uShy.x, uShy.y, sp.x) * smoothstep(uShy.z, uShy.w, 1.0 - sp.y);
    if (tWater > 1e4) keep = 0.0;
    if (keep < 0.003 && fur.a < 0.003) {
      // 什么都留不下的地方（大半张画面）就不用往下算了
      oColor = vec4(0.0);
      oPlate = vec4(1.0 - uDark, 0.0, 0.0, 1.0);
      return;
    }
    const float e = 0.012;
    float h0 = ripple(xz, t);
    vec3 nw = normalize(vec3(h0 - ripple(xz + vec2(e, 0.0), t), e, h0 - ripple(xz + vec2(0.0, e), t)));
    float relief = 1.5 * (dot(nw, SUN) - SUN.y);          // 浪的朝光面亮、背光面暗
    float glint = pow(max(dot(reflect(rd, nw), SUN), 0.0), 120.0);
    vec3 bw = toBody(vec3(pw.x, 0.0, pw.z));
    float dObj = sdSkin(bw, toHead(bw)) - 0.03;           // 水面上这一点离它（连毛带皮）多远
    float shadow = dObj < 0.9 ? 1.0 - softShadow(vec3(pw.x, 0.006, pw.z), SUN) : 0.0;
    float contact = exp(-max(dObj, 0.0) * 9.0);           // 贴着身子的一圈暗
    float lip = smoothstep(0.03, 0.0, abs(dObj - 0.014)); // 贴着身子的一道水线，是亮的
    float sunk = smoothstep(0.02, -0.06, dObj);           // 沉在水下的那半个身子：透过水隐约看得见

    float day = clamp(0.99 + min(relief, 0.0) * 0.85 + max(relief, 0.0) * 0.2 - 0.34 * shadow - 0.24 * contact + 0.5 * glint + 0.16 * lip * (1.0 - sunk) - 0.42 * sunk, 0.0, 1.0);
    float night = clamp(0.02 + 0.9 * pow(max(relief, 0.0), 1.3) + 0.9 * glint + 0.4 * lip + 0.04 * contact + 0.05 * sunk, 0.0, 1.0);
    backLight = mix(day, night, uDark);
    back = mix(pow(vec3(0.93, 0.955, 0.97) * day, vec3(2.2)), pow(vec3(0.045, 0.07, 0.115) + vec3(0.62, 0.74, 0.95) * night, vec3(2.2)), uDark);
    back = mix(back, back * vec3(0.62, 0.5, 0.38), sunk * (1.0 - uDark));
  }

  vec3 col = fur.rgb + back * (1.0 - fur.a);
  float light = furLight + backLight * (1.0 - fur.a);
  keep = max(keep, fur.a);
  oColor = vec4(col, keep);
  oPlate = vec4(light, blue, stone, clamp((depth - NEAR) / DEPTH, 0.0, 1.0));
}`;

export const PRINT_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uColor;
uniform sampler2D uPlate;
uniform sampler2D uGlyph;  // 字符模式用的字形：一排，由疏到密
uniform vec2  uRes;        // 画布的分辨率（设备像素）
uniform float uPx;         // 一个 CSS 像素是几个设备像素
uniform float uCell;       // 一个网点 / 一个字符格多大（设备像素）
uniform float uGlyphs;     // 字形一共几个
uniform int   uMode;       // 0 网点，1 字符，2 抖动，3 照片
uniform float uDark;
uniform vec3  uInk;
uniform vec3  uBlue;

// 胡须是空间里真的线，所以这里要知道镜头在哪，才能算出每个像素的视线
uniform vec2  uCenter;
uniform float uZoom;
uniform vec3  uEye;        // 镜头的位置
uniform mat3  uCam;        // 镜头的三个方向（三列）：右、上、前
uniform vec3  uWhisk[24];  // 八根胡须，每根三个点：根、中间、梢（世界坐标）
uniform vec3  uFace;       // 脸在画布上的位置和大小（设备像素）：只在它附近才去算胡须

out vec4 o;

const float NEAR = 2.6;
const float DEPTH = 2.8;

// 黑版要印多少：浅色主题下暗处上墨；深色主题下「墨」是亮的，亮处才上
float inkOf(vec4 pl) {
  // 深色主题下把中间调压暗一些：身上的深色毛才不会和头一样亮
  return uDark > 0.5 ? pow(pl.r, 1.7) * (1.0 - pl.b) : (1.0 - pl.r) * (1.0 - pl.b * 0.9);
}

// 一层转了角度的网点：每个格子在自己的中心采一次样，暗的地方点大、亮的地方点小
float screen(vec2 frag, float angle, int plate) {
  float c = cos(angle), s = sin(angle);
  mat2 R = mat2(c, -s, s, c);
  vec2 g = R * frag / uCell;
  vec2 cell = floor(g) + 0.5;
  vec2 at = (transpose(R) * cell) * uCell / uRes;
  vec4 pl = texture(uPlate, at);
  float amount = (plate == 0 ? inkOf(pl) : pl.g) * texture(uColor, at).a;
  if (amount < 0.004) return 0.0;
  float r = 0.74 * sqrt(clamp(amount, 0.0, 1.0));
  float aa = 0.8 / uCell;
  return smoothstep(r + aa, r - aa, length(g - cell));
}

float bayer(vec2 p) {
  const float M[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  ivec2 i = ivec2(mod(p, 4.0));
  return (M[i.y * 4 + i.x] + 0.5) / 16.0;
}

// 胡须：每根是一小段弧线（四段折线），根粗梢细。
// 对每一段算出视线离它最近的那一下：够近、而且没被前面的东西挡住，才画。
float whiskers(vec2 frag) {
  if (length(frag - uFace.xy) > uFace.z) return 0.0;
  vec2 uv = (frag - uRes * uCenter) / uRes.y;
  vec3 rd = normalize(uCam * vec3(uv, uZoom));
  float seen = NEAR + DEPTH * texture(uPlate, frag / uRes).a + 0.035;   // 照片里这一点有多深
  float m = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 A = uWhisk[i * 3], M = uWhisk[i * 3 + 1], B = uWhisk[i * 3 + 2];
    vec3 prev = A;
    for (int j = 1; j <= 4; j++) {
      float s = float(j) / 4.0;
      vec3 next = mix(mix(A, M, s), mix(M, B, s), s);
      vec3 ab = next - prev, ao = prev - uEye;
      float abab = dot(ab, ab), abrd = dot(ab, rd);
      float k = clamp((dot(ao, rd) * abrd - dot(ao, ab)) / max(abab - abrd * abrd, 1e-6), 0.0, 1.0);
      vec3 c = prev + ab * k;
      float t = dot(c - uEye, rd);
      float px = t / (uZoom * uRes.y);                         // 这个深度上，一个设备像素有多宽
      float along = (float(j - 1) + k) / 4.0;                  // 从根到梢走了多少
      float cover = clamp(mix(0.95, 0.3, along) * uPx - length(uEye + rd * t - c) / px + 0.5, 0.0, 1.0);
      if (t < seen) m = max(m, cover);
      prev = next;
    }
  }
  return m;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float k = 0.0, b = 0.0;
  float wk = whiskers(frag);

  if (uMode == 0) {
    // 网点：黑版 45°，蓝版 15°，和双色胶印一样错开角度
    k = screen(frag, 0.7854, 0);
    b = screen(frag, 0.2618, 1);
  } else if (uMode == 1) {
    // 字符：一个格子（宽 1、高 2）一个字，墨越多字越密
    vec2 size = vec2(uCell, uCell * 2.0);
    vec2 g = frag / size;
    vec2 cell = floor(g);
    vec2 at = (cell + 0.5) * size / uRes;
    vec4 pl = texture(uPlate, at);
    float keep = texture(uColor, at).a;
    float ink = inkOf(pl) * keep, blu = pl.g * keep;
    float amount = max(ink, blu);
    float idx = floor(clamp(amount, 0.0, 0.999) * uGlyphs);
    vec2 in_ = fract(g);
    float cov = texture(uGlyph, vec2((idx + in_.x) / uGlyphs, 1.0 - in_.y)).r;
    if (blu > ink) b = cov; else k = cov;
  } else if (uMode == 2) {
    // 有序抖动：最老实的黑白像素
    float px = max(2.0, floor(uCell * 0.5));
    vec2 cell = floor(frag / px);
    vec2 at = (cell + 0.5) * px / uRes;
    vec4 pl = texture(uPlate, at);
    float keep = texture(uColor, at).a;
    float th = bayer(cell);
    k = step(th, inkOf(pl) * keep);
    b = step(th, pl.g * keep);
  } else {
    // 照片：不印，直接看。胡须是半透明的象牙白，压在深色的毛上才显出来
    vec4 c = texture(uColor, frag / uRes);
    vec3 rgb = pow(clamp(c.rgb, 0.0, 1.0), vec3(0.4545));
    float a = max(c.a, wk * 0.85);
    o = vec4(mix(rgb, mix(vec3(0.99, 0.97, 0.93), vec3(0.45, 0.4, 0.36), smoothstep(0.55, 0.9, dot(rgb, vec3(0.333)))), wk * 0.85) * a, a);
    return;
  }

  // 先印蓝，再印黑，最后描胡须；没有墨的地方是透明的，露出底下的纸
  k = max(k, wk * 0.8);
  float a = 1.0 - (1.0 - b) * (1.0 - k);
  o = vec4(uBlue * b * (1.0 - k) + uInk * k, a);
}`;
