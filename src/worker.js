import { buildDiagnosisShadowReport } from './diagnosis/shadow.js';

const STORE_CODE = 'STORE001';
// 门店主档在系统侧维护。即使某店当天尚无销售，也要有零基线物料台账，
// 才能作为调拨调入方接收库存并形成独立流水。
const R2_STORE_MASTERS = Object.freeze([
  { store_code: 'STORE001', store_name: '小茶日记', region: '总部运营', status: '营业中', store_role: '普通门店', franchisee: 'MOMOYO 印尼加盟商' },
  { store_code: 'STORE002', store_name: '小茶日记·Pro店', region: '总部运营', status: '营业中', store_role: '旗舰店', franchisee: 'MOMOYO 印尼加盟商' },
  { store_code: 'STORE003', store_name: '小茶日记·街边店', region: '总部运营', status: '营业中', store_role: '普通门店', franchisee: 'MOMOYO 印尼加盟商' },
  { store_code: 'STORE004', store_name: 'MMY-BANTEN-SANGGIANG', region: '总部运营', status: '营业中', store_role: '普通门店', franchisee: 'MOMOYO 印尼加盟商' },
  { store_code: 'STORE005', store_name: 'MOMOYO CILEDUG', region: '雅加达', status: '营业中', store_role: '普通门店', franchisee: 'MOMOYO 印尼加盟商' },
  { store_code: 'STORE006', store_name: 'MOMOYO BENHIL', region: '雅加达', status: '营业中', store_role: '普通门店', franchisee: 'MOMOYO 印尼加盟商' }
]);
const R2_STORE_CODES = Object.freeze(R2_STORE_MASTERS.map((item) => item.store_code));
// 耗材只参与库存流水，不纳入每日逐项实盘；需要时仍可由报损、调拨或定向盘点处理。
const R2_DAILY_COUNT_EXCLUDED_MATERIALS = Object.freeze(['半成品奶茶', '杯子', '冰块', '勺子', '双杯袋', '四杯袋', '塑料杯', '吸管']);
const R2_PRODUCT_MASTERS = Object.freeze([
  { sku_code: 'SKU001', product_name: '伯牙绝弦', product_alias: '伯牙', product_type: '茶饮', category: '奶茶' },
  { sku_code: 'SKU002', product_name: '桂馥兰香', product_alias: '桂馥', product_type: '茶饮', category: '奶茶' },
  { sku_code: 'SKU003', product_name: '桃桃乌龙', product_alias: '桃桃', product_type: '茶饮', category: '果茶' },
  { sku_code: 'SKU004', product_name: '茉莉奶绿', product_alias: '奶绿', product_type: '茶饮', category: '奶茶' },
  { sku_code: 'SKU005', product_name: '芋泥波波奶茶', product_alias: '芋泥', product_type: '茶饮', category: '奶茶' },
  { sku_code: 'SKU006', product_name: '生椰拿铁', product_alias: '生椰', product_type: '茶饮', category: '咖啡' },
  { sku_code: 'SKU007', product_name: '草莓芝士', product_alias: '草莓', product_type: '茶饮', category: '果茶' },
  { sku_code: 'SKU008', product_name: '全麦欧包', product_alias: '欧包', product_type: 'OEM', category: '烘焙' },
  { sku_code: 'SKU009', product_name: '肉松小贝', product_alias: '小贝', product_type: 'OEM', category: '烘焙' },
  { sku_code: 'SKU010', product_name: '抹茶蛋糕', product_alias: '抹茶', product_type: 'OEM', category: '烘焙' },
  { sku_code: 'SKU011', product_name: 'Brown Sugar Boba Milk Tea 400 N', product_alias: '黑糖奶茶', product_type: '茶饮', category: '奶茶', aliases: ['Brown Sugar Boba Milk Tea', '黑糖珍珠奶茶', '黑糖珍珠奶茶400N'] },
  { sku_code: 'SKU012', product_name: 'Roasted Oolong Milk Tea', product_alias: 'Oolong', product_type: '茶饮', category: '奶茶', aliases: ['烘焙乌龙奶茶'] },
  { sku_code: 'SKU013', product_name: 'Brown Sugar Boba Milk Tea 500 N', product_alias: '黑糖奶茶', product_type: '茶饮', category: '奶茶', aliases: ['Brown Sugar Boba Milk Tea Large', '黑糖珍珠奶茶大杯'] },
  { sku_code: 'SKU014', product_name: 'Brown Sugar Boba Milk Tea 500 LS', product_alias: '黑糖奶茶', product_type: '茶饮', category: '奶茶' },
  { sku_code: 'SKU015', product_name: 'Brown Sugar Boba Milk Tea 700 B N', product_alias: '黑糖奶茶', product_type: '茶饮', category: '奶茶' },
  { sku_code: 'SKU016', product_name: 'Brown Sugar Boba Milk Tea 700 B LS', product_alias: '黑糖奶茶', product_type: '茶饮', category: '奶茶' },
  { sku_code: 'SKU017', product_name: 'Oreo Sundae', product_alias: 'Oreo', product_type: '雪糕', category: '雪糕' },
  { sku_code: 'SKU018', product_name: 'Brown Sugar Boba Milk Tea 400 LS', product_alias: '黑糖奶茶', product_type: '茶饮', category: '奶茶' }
]);
const R2_REAL_PRODUCT_SKUS = Object.freeze(['SKU011', 'SKU013', 'SKU014', 'SKU015', 'SKU016', 'SKU018']);
const R2_REAL_PRODUCT_SKU_SET = new Set(R2_REAL_PRODUCT_SKUS);
const R2_MATERIAL_MASTERS = Object.freeze([
  { material_name: '牛奶', base_unit: 'L', procurement_unit: 'L', conversion_factor: 1, remark: '飞鹤纯牛奶 1L 装', brand: '小茶日记' },
  { material_name: '糖浆', base_unit: 'kg', procurement_unit: 'kg', conversion_factor: 1, remark: '中粮果糖糖浆 5kg/桶', brand: '小茶日记' },
  { material_name: '茶叶', base_unit: 'kg', procurement_unit: 'kg', conversion_factor: 1, remark: '立顿茉莉绿茶 1kg/包', brand: '小茶日记' },
  { material_name: '杯子', base_unit: '个', procurement_unit: '箱', conversion_factor: 100, remark: '嘉顿一次性杯子 500ml/只', brand: '小茶日记', daily_count_enabled: false },
  { material_name: '黑糖珍珠', base_unit: 'g', procurement_unit: 'kg', conversion_factor: 1000, remark: '1包=1kg=1000g', brand: 'MOMOYO' },
  { material_name: '黑糖冻', base_unit: 'kg', procurement_unit: 'kg', conversion_factor: 1, remark: '', brand: 'MOMOYO' },
  { material_name: '黑糖成品', base_unit: 'kg', procurement_unit: 'kg', conversion_factor: 1, remark: '', brand: 'MOMOYO' },
  { material_name: '果糖', base_unit: 'kg', procurement_unit: 'kg', conversion_factor: 1, remark: '', brand: 'MOMOYO' },
  { material_name: '冰块', base_unit: 'kg', procurement_unit: 'kg', conversion_factor: 1, remark: '', brand: 'MOMOYO', daily_count_enabled: false },
  { material_name: '半成品奶茶', base_unit: 'g', procurement_unit: 'g', conversion_factor: 1, remark: '已拆2级：鲜牛奶80%+…', brand: 'MOMOYO', daily_count_enabled: false },
  { material_name: '塑料杯', base_unit: '个', procurement_unit: '箱', conversion_factor: 100, remark: '塑料杯、占位，等 BOM …', brand: 'MOMOYO', daily_count_enabled: false },
  { material_name: '吸管', base_unit: '个', procurement_unit: '箱', conversion_factor: 5000, remark: 'A0037 23cm长粗吸管', brand: 'MOMOYO', daily_count_enabled: false },
  { material_name: '双杯袋', base_unit: '个', procurement_unit: '箱', conversion_factor: 4000, remark: 'A0040 双杯袋，1箱=4000个', brand: 'MOMOYO', daily_count_enabled: false },
  { material_name: '四杯袋', base_unit: '个', procurement_unit: '箱', conversion_factor: 3000, remark: 'A0045 Four Cup Bag', brand: 'MOMOYO', daily_count_enabled: false },
  { material_name: '鲜牛奶', base_unit: 'L', procurement_unit: 'L', conversion_factor: 1, remark: '纯牛奶，用于半成品奶茶', brand: 'MOMOYO' },
  { material_name: '红茶叶', base_unit: 'g', procurement_unit: 'kg', conversion_factor: 1000, remark: '红茶茶叶，用于半成品', brand: 'MOMOYO' },
  { material_name: '乌龙茶叶', base_unit: 'g', procurement_unit: 'kg', conversion_factor: 1000, remark: '乌龙茶茶叶，用于 Roasted Oolong', brand: 'MOMOYO' },
  { material_name: 'Oreo 饼干', base_unit: 'g', procurement_unit: 'kg', conversion_factor: 1000, remark: 'Oreo 饼干碎，用于 Oreo 产品', brand: 'MOMOYO' },
  { material_name: '雪糕基料', base_unit: 'L', procurement_unit: 'L', conversion_factor: 1, remark: '雪糕/冰淇淋基料', brand: 'MOMOYO' },
  { material_name: '勺子', base_unit: '个', procurement_unit: '箱', conversion_factor: 100, remark: '一次性勺子，用于 Oreo 产品', brand: 'MOMOYO', daily_count_enabled: false }
]);
// 安全库存独立于期初、收货和实盘，是门店物料在指定基础单位下的补货警戒线。
// 安全库存只在已启用的门店生效；未配置的门店和物料不会产生补货预警。
const R2_SAFETY_STOCK_POLICIES = Object.freeze([
  { store_code: 'STORE001', material_name: '牛奶', safety_qty: 60, unit: 'L' },
  { store_code: 'STORE001', material_name: '糖浆', safety_qty: 20, unit: 'kg' },
  { store_code: 'STORE001', material_name: '杯子', safety_qty: 250, unit: '个' },
  { store_code: 'STORE001', material_name: '茶叶', safety_qty: 2, unit: 'kg' }
]);
const DASHBOARD_URL = 'https://inventory-count-closure-demo.gdjustwuxia.workers.dev/?focus=inventory';
const STOCK_STANDARD = [
  { material: '牛奶', materialCode: 'MAT-MILK', expected: 29.4, unit: 'L' },
  { material: '糖浆', materialCode: 'MAT-SYRUP', expected: 41.1, unit: 'kg' },
  { material: '杯子', materialCode: 'MAT-CUP', expected: 1309, unit: '个' }
];
const FEISHU_BASE_TOKEN = 'SVwKb8N17aQDNSsuddmcL95fnLg';
const FEISHU_SALES_TABLE_ID = 'tbly9ewKpWTpeQzC';
const FEISHU_BOM_TABLE_ID = 'tbl3DtZPX3kwct1A';
const FEISHU_MATERIAL_TABLE_ID = 'tblFTA3dL0z2gNFu';
const FEISHU_PRODUCT_TABLE_ID = 'tbl5TpmrmGN8A7tW';
const FEISHU_LEDGER_TABLE_ID = 'tblGDep7xILyvVgy';
const FEISHU_TRANSFER_TABLE_ID = 'tblGCN6WftHFSjyg';
const FEISHU_TRANSFER_DETAIL_TABLE_ID = 'tblroRBpqqCdrTVv';
const FEISHU_STORE_FLOW_TABLE_ID = 'tblG341iQHvU1nSc';
const HIGHLIGHT_DEMO_SKU = 'SKU011';
// 不注入人为负库存或安全库存情境；研判仅由飞书同步数据和门店实际操作触发。
const R2_MATERIAL_DIAGNOSIS_SCENARIOS = Object.freeze({});
const R2_NEGATIVE_TOLERANCE_BY_UNIT = { kg: 0.05, L: 0.1, g: 50, '个': 1 };
const R2_INDUSTRY_MATERIAL_RULES = Object.freeze({
  packaging_consumable: { code: 'packaging_consumable', label: '包装耗材', count_tolerance_rate: 0.02, absolute_tolerance: { '个': 2 }, production_required: false, normal_loss_rule: '破损、试机和非销售领用应单独登记', required_evidence: ['库存单位必须为整数', '破损 / 领用记录', '整包与散件换算'] },
  perishable_liquid: { code: 'perishable_liquid', label: '易耗液体原料', count_tolerance_rate: 0.03, absolute_tolerance: { L: 0.2, kg: 0.2 }, production_required: false, normal_loss_rule: '开封余量、过期与制作损耗需区分', required_evidence: ['收货单与到货日期', '箱 / 瓶 / L 单位换算', '过期或制作报损'] },
  prepared_component: { code: 'prepared_component', label: '现制 / 半成品', count_tolerance_rate: 0.08, absolute_tolerance: { kg: 0.2, L: 0.2 }, production_required: true, normal_loss_rule: '应考虑制作出成率、留样、过期与锅底损耗', required_evidence: ['制作 / 领料批次', '标准出成率', '过期与报损记录', '成品盘点单位'] },
  melt_loss_material: { code: 'melt_loss_material', label: '自然损耗物料', count_tolerance_rate: 0.15, absolute_tolerance: { kg: 1 }, production_required: true, normal_loss_rule: '融化与制备损耗较大，不宜套用普通原料阈值', required_evidence: ['制备或领用记录', '盘点时点', '自然损耗口径'] },
  measured_ingredient: { code: 'measured_ingredient', label: '称重 / 计量原料', count_tolerance_rate: 0.05, absolute_tolerance: { kg: 0.1, L: 0.1 }, production_required: false, normal_loss_rule: '重点核验采购包装、开封余量和称重单位', required_evidence: ['采购单位换算', '收货数量', '开封余量称重', '报损 / 内部领用'] },
  general_material: { code: 'general_material', label: '一般库存物料', count_tolerance_rate: 0.05, absolute_tolerance: { kg: 0.1, L: 0.1, '个': 2 }, production_required: false, normal_loss_rule: '采用通用库存差异规则，等待门店确认具体属性', required_evidence: ['收货与调拨流水', '盘点单位', '报损记录'] }
});
const FEISHU_EVENT_SOURCE_SCHEMA = [
  { key: 'receipt', label: '收货入库', table: '待绑定飞书收货表', direction: '入库', fields: '门店、收货日期、物料、数量、单位、收货单号', status: 'pending_mapping' },
  { key: 'scrap', label: '报损出库', table: '待绑定飞书报损表', direction: '出库', fields: '门店、报损日期、物料、数量、单位、报损单号 / 原因', status: 'pending_mapping' },
  { key: 'transfer', label: '门店调拨', table: '飞书 · 调拨单主表 + 调拨单明细', direction: '调入 / 调出', fields: '调出方、调入方、调拨日期、物料、数量、单位、调拨单号', status: 'connected', table_id: FEISHU_TRANSFER_TABLE_ID, detail_table_id: FEISHU_TRANSFER_DETAIL_TABLE_ID }
  , { key: 'store_inventory_flow', label: '门店库存流水', table: '飞书 · 门店库存流水', direction: '库存档案', fields: '门店、业务日期、物料、方向、计划数量、实际数量、关联调拨单号', status: 'archive_mapped', table_id: FEISHU_STORE_FLOW_TABLE_ID }
];

const R2_NOTIFICATION_DEFAULTS = Object.freeze({
  channel: 'feishu_group_bot', group_label: '品牌运营群', timezone: 'Asia/Shanghai',
  realtime: { enabled: false, cooldown_minutes: 30, rules: { negative_inventory: true, below_safety_stock: true, transfer_exception: true } },
  daily_report: { enabled: false, send_time: '20:00', include: { sales: true, inventory_risks: true, transfers: true, count_plans: true } },
  templates: {
    realtime_title: '门店库存异常提醒',
    daily_title: '门店运营日报',
    footer: '请进入运营 Demo 查看台账、单据与研判闭环。'
  }
});

const R2_DIAGNOSIS_ATTRIBUTIONS = Object.freeze({
  receipt_missing: '门店未及时收货 / 收货漏录',
  prior_negative: '上周期负库存遗留',
  opening_baseline: '系统期初 / 日结固化错误',
  bom_configuration: 'BOM 配方 / 版本错误',
  unit_conversion: '单位换算错误',
  count_entry: '盘点单位 / 数量录入错误',
  unrecorded_loss: '未登记报损 / 内部领用',
  production_yield: '半成品出成率偏差',
  sync_process: '系统同步 / 流程问题',
  other: '其他人工归因'
});

function id(prefix) { return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; }
function now() { return new Date().toISOString(); }
function chinaBusinessDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()); }
function json(data, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
function bad(message, status = 400) { return json({ error: message }, status); }
function base64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
function validPreviewData(value) {
  if (typeof value !== 'string') return null;
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return null;
  return value.length <= 360000 ? value : null;
}

// Demo workflow state deliberately lives outside D1.  The production-facing
// Feishu import and material ledger remain relational data; task flow, proof
// metadata and resettable demo actions are a small, versioned R2 document.
const R2_DEMO_CURRENT_KEY = 'demo-state/current.json';
const R2_DEMO_INITIAL_KEY = 'demo-state/initial.json';
const R2_DEMO_HISTORY_PREFIX = 'demo-state/history/';

function r2DemoInitialState() {
  return {
    version: 1,
    storeCode: STORE_CODE,
    storeMasters: r2DefaultStoreMasters(),
    productCatalog: r2DefaultProductCatalog(),
    materialCatalog: r2DefaultMaterialCatalog(),
    safetyStockPolicies: r2DefaultSafetyStockPolicies(),
    stockStandard: STOCK_STANDARD,
    task: null,
    operationTask: null,
    operationTasks: [],
    governanceTasks: [],
    anomalyClosures: [],
    materialAnomalies: [],
    diagnosisCases: [],
    diagnosisKnowledge: [],
    materialEvents: [],
    transferOrders: [],
    storeTransferRequests: [],
    restockRequests: [],
    purchaseOrders: [],
    receiptOrders: [],
    storeAgentSessions: [],
    transferArchives: [],
    countPlans: [],
    countPhotoReviews: [],
    countPlanGateResults: [],
    demoDaySessions: [],
    ledgerSnapshots: [],
    notificationSettings: cloneNotificationSettings(R2_NOTIFICATION_DEFAULTS),
    notificationDeliveries: [],
    feishuEventSources: FEISHU_EVENT_SOURCE_SCHEMA,
    documents: [],
    audits: [],
    demoSales: null,
    storage: { provider: 'R2', mode: 'demo-workflow', updatedAt: now() }
  };
}

function cloneDemoState(value) { return JSON.parse(JSON.stringify(value)); }
function cloneNotificationSettings(value) { return JSON.parse(JSON.stringify(value)); }
function r2DefaultStoreMasters() { return R2_STORE_MASTERS.map((item) => ({ ...item })); }
function r2ProductDataClassification(skuCode) { return R2_REAL_PRODUCT_SKU_SET.has(skuCode) ? 'brand_real' : 'mvp_mock'; }
function r2DefaultProductCatalog() {
  return R2_PRODUCT_MASTERS.map((item) => ({
    ...item,
    aliases: Array.isArray(item.aliases) ? [...item.aliases] : [],
    data_classification: r2ProductDataClassification(item.sku_code),
    data_label: R2_REAL_PRODUCT_SKU_SET.has(item.sku_code) ? '品牌真实商品' : 'MVP Mock',
    source: R2_REAL_PRODUCT_SKU_SET.has(item.sku_code) ? '飞书商品/BOM 白名单' : 'MVP 演示商品'
  }));
}
function r2NormalizeProductCatalog(items) {
  const source = Array.isArray(items) && items.length ? items : r2DefaultProductCatalog();
  return source.map((item) => ({
    ...item,
    aliases: Array.isArray(item.aliases) ? [...item.aliases] : [],
    data_classification: r2ProductDataClassification(item.sku_code),
    data_label: R2_REAL_PRODUCT_SKU_SET.has(item.sku_code) ? '品牌真实商品' : 'MVP Mock',
    source: R2_REAL_PRODUCT_SKU_SET.has(item.sku_code) ? '飞书商品/BOM 白名单' : 'MVP 演示商品'
  }));
}
function r2DefaultMaterialCatalog() { return R2_MATERIAL_MASTERS.map((item) => ({ ...item, count_policy: item.daily_count_enabled === false ? 'optional' : 'daily', status: 'active', source: '总部物料主档' })); }
function r2DefaultSafetyStockPolicies() { return R2_SAFETY_STOCK_POLICIES.map((item) => ({ ...item, status: 'active', owner: '供应链 / 营运', source: '总部安全库存配置' })); }

function r2MasterDataQuality(value) {
  const stores = value.storeMasters?.length ? value.storeMasters : R2_STORE_MASTERS;
  const products = r2NormalizeProductCatalog(value.productCatalog);
  const materials = r2NormalizeMaterialCatalog(value.materialCatalog);
  const imported = value.feishuImport || {};
  const blocking = [];
  const duplicate = (items, getter) => {
    const seen = new Set(), duplicates = new Set();
    for (const item of items) { const key = normalizedKey(getter(item)); if (seen.has(key)) duplicates.add(getter(item)); else seen.add(key); }
    return [...duplicates];
  };
  const duplicateStores = duplicate(stores, (item) => item.store_code);
  const duplicateProducts = duplicate(products, (item) => item.sku_code);
  const duplicateMaterials = duplicate(materials, (item) => item.material_name);
  if (duplicateStores.length) blocking.push(`门店编码重复：${duplicateStores.join('、')}`);
  if (duplicateProducts.length) blocking.push(`SKU 重复：${duplicateProducts.join('、')}`);
  if (duplicateMaterials.length) blocking.push(`物料名称重复：${duplicateMaterials.join('、')}`);
  for (const item of materials) {
    if (!item.base_unit || !item.procurement_unit || !(Number(item.conversion_factor) > 0)) blocking.push(`${item.material_name}的单位或换算系数无效`);
  }
  const processMaterials = ['半成品奶茶', '黑糖成品', '黑糖冻'];
  const processRuleFields = ['yield_rate', 'loss_rate', 'shelf_life_hours'];
  const processRuleGaps = processMaterials.map((name) => {
    const material = materials.find((item) => normalizedKey(item.material_name) === normalizedKey(name));
    return { material_name: name, missing_fields: processRuleFields.filter((field) => !(Number(material?.[field]) > 0)) };
  }).filter((item) => item.missing_fields.length);
  const brandBomCounts = imported.bom_sync?.brand_sku_counts || {};
  const brandBomComplete = R2_REAL_PRODUCT_SKUS.every((sku) => Number(brandBomCounts[sku] || 0) === 9)
    || R2_REAL_PRODUCT_SKUS.every((sku) => Array.isArray(imported.bom_by_sku?.[sku]) && imported.bom_by_sku[sku].length === 9);
  if (imported.sales?.length && !brandBomComplete) blocking.push('6 个 Brown Sugar 品牌 SKU 未全部通过每个 9 条 BOM 的完整性门禁');
  return {
    status: blocking.length ? 'blocked' : processRuleGaps.length ? 'warning' : 'ready',
    inventory_core_ready: blocking.length === 0,
    brand_process_rules_ready: processRuleGaps.length === 0,
    counts: { stores: stores.length, products: products.length, materials: materials.length, daily_count: materials.filter((item) => item.count_policy === 'daily').length, optional_count: materials.filter((item) => item.count_policy === 'optional').length, brand_real_skus: products.filter((item) => item.data_classification === 'brand_real').length },
    blocking_issues: blocking,
    warnings: processRuleGaps.length ? ['品牌半成品工艺参数未定版；当前不启用出成率、损耗率或保质期自动判定。'] : [],
    process_rule_gaps: processRuleGaps,
    checked_at: now()
  };
}

function r2NormalizeMaterialCatalog(items) {
  const defaults = new Map(r2DefaultMaterialCatalog().map((item) => [normalizedKey(item.material_name), item]));
  return (Array.isArray(items) && items.length ? items : r2DefaultMaterialCatalog()).map((item) => {
    const fallback = defaults.get(normalizedKey(item.material_name));
    const countPolicy = item.count_policy === 'optional' || item.count_policy === 'daily'
      ? item.count_policy
      : typeof item.daily_count_enabled === 'boolean'
        ? (item.daily_count_enabled ? 'daily' : 'optional')
        : (fallback?.count_policy || 'daily');
    return { ...item, count_policy: countPolicy, daily_count_enabled: countPolicy === 'daily' };
  });
}

function normalizeR2DemoState(value) {
  const initial = r2DemoInitialState();
  const source = value && typeof value === 'object' ? value : {};
  const diagnosisCases = (Array.isArray(source.diagnosisCases) ? source.diagnosisCases : []).map((caseItem) => {
    const variances = caseItem.status === 'needs_hq_action' ? (caseItem.last_count_result?.variances || []).filter((line) => line.exceeded) : [];
    if (!variances.length) return caseItem;
    const materialName = variances.length === 1 ? variances[0].material_name : null;
    const label = materialName ? `再次下发 ${materialName} 定向盘点` : `对剩余 ${variances.length} 项差异物料继续复核`;
    const recommended = (caseItem.recommended_actions || []).filter((item) => item.type !== 'targeted_count');
    return { ...caseItem, recommended_actions: [...recommended, { type: 'targeted_count', label, owner: `${caseItem.store_code} 店长`, status: 'recommended', material_name: materialName, unit: materialName ? variances[0].unit : null }] };
  });
  return {
    ...initial,
    ...source,
    stockStandard: Array.isArray(source.stockStandard) ? source.stockStandard : initial.stockStandard,
    storeMasters: Array.isArray(source.storeMasters) && source.storeMasters.length ? source.storeMasters : initial.storeMasters,
    productCatalog: r2NormalizeProductCatalog(source.productCatalog),
    materialCatalog: r2NormalizeMaterialCatalog(source.materialCatalog),
    safetyStockPolicies: Array.isArray(source.safetyStockPolicies) ? source.safetyStockPolicies : initial.safetyStockPolicies,
    operationTasks: Array.isArray(source.operationTasks) ? source.operationTasks : [],
    governanceTasks: Array.isArray(source.governanceTasks) ? source.governanceTasks : [],
    anomalyClosures: Array.isArray(source.anomalyClosures) ? source.anomalyClosures : [],
    materialAnomalies: Array.isArray(source.materialAnomalies) ? source.materialAnomalies : [],
    diagnosisCases,
    diagnosisKnowledge: Array.isArray(source.diagnosisKnowledge) ? source.diagnosisKnowledge : [],
    materialEvents: Array.isArray(source.materialEvents) ? source.materialEvents : [],
    transferOrders: Array.isArray(source.transferOrders) ? source.transferOrders : [],
    storeTransferRequests: Array.isArray(source.storeTransferRequests) ? source.storeTransferRequests : [],
    restockRequests: Array.isArray(source.restockRequests) ? source.restockRequests : [],
    purchaseOrders: Array.isArray(source.purchaseOrders) ? source.purchaseOrders : [],
    receiptOrders: Array.isArray(source.receiptOrders) ? source.receiptOrders : [],
    storeAgentSessions: Array.isArray(source.storeAgentSessions) ? source.storeAgentSessions.slice(0, 80) : [],
    transferArchives: Array.isArray(source.transferArchives) ? source.transferArchives : [],
    countPlans: Array.isArray(source.countPlans) ? source.countPlans : [],
    countPhotoReviews: Array.isArray(source.countPhotoReviews) ? source.countPhotoReviews.slice(0, 40) : [],
    countPlanGateResults: Array.isArray(source.countPlanGateResults) ? source.countPlanGateResults : [],
    demoDaySessions: Array.isArray(source.demoDaySessions) ? source.demoDaySessions : [],
    ledgerSnapshots: Array.isArray(source.ledgerSnapshots) ? source.ledgerSnapshots : [],
    notificationSettings: normalizeNotificationSettings(source.notificationSettings),
    notificationDeliveries: Array.isArray(source.notificationDeliveries) ? source.notificationDeliveries : [],
    feishuEventSources: Array.isArray(source.feishuEventSources) ? source.feishuEventSources : initial.feishuEventSources,
    documents: Array.isArray(source.documents) ? source.documents : [],
    audits: Array.isArray(source.audits) ? source.audits : [],
    storage: { provider: 'R2', mode: 'demo-workflow', updatedAt: source.storage?.updatedAt || now() }
  };
}

function normalizeNotificationSettings(source) {
  const defaults = cloneNotificationSettings(R2_NOTIFICATION_DEFAULTS);
  const input = source && typeof source === 'object' ? source : {};
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(input.daily_report?.send_time || ''));
  return {
    ...defaults,
    ...input,
    group_label: String(input.group_label || defaults.group_label).trim().slice(0, 60),
    realtime: { ...defaults.realtime, ...(input.realtime || {}), rules: { ...defaults.realtime.rules, ...(input.realtime?.rules || {}) } },
    daily_report: { ...defaults.daily_report, ...(input.daily_report || {}), send_time: validTime ? input.daily_report.send_time : defaults.daily_report.send_time, include: { ...defaults.daily_report.include, ...(input.daily_report?.include || {}) } },
    templates: { ...defaults.templates, ...(input.templates || {}) }
  };
}

async function r2ReadJson(bucket, key) {
  const object = await bucket.get(key);
  return object ? object.json() : null;
}

async function r2DemoState(env) {
  const saved = await r2ReadJson(env.DEMO_STATE, R2_DEMO_CURRENT_KEY);
  if (saved) return normalizeR2DemoState(saved);
  const initial = r2DemoInitialState();
  const body = JSON.stringify(initial);
  await env.DEMO_STATE.put(R2_DEMO_INITIAL_KEY, body, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  await env.DEMO_STATE.put(R2_DEMO_CURRENT_KEY, body, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  return initial;
}

async function r2SaveDemoState(env, value, action = 'update') {
  const stateValue = normalizeR2DemoState(value);
  stateValue.storage = { provider: 'R2', mode: 'demo-workflow', updatedAt: now(), lastAction: action };
  const serialized = JSON.stringify(stateValue);
  const stamp = stateValue.storage.updatedAt.replace(/[:.]/g, '-');
  await env.DEMO_STATE.put(R2_DEMO_CURRENT_KEY, serialized, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  await env.DEMO_STATE.put(`${R2_DEMO_HISTORY_PREFIX}${stamp}-${action}.json`, serialized, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  return stateValue;
}

function r2Result(stateValue, status = 200) { return json(stateValue, status); }

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

async function transcribeVoice(request, env) {
  if (!env.AI) return bad('语音转写服务尚未配置。', 503);
  const declaredSize = Number(request.headers.get('content-length') || 0);
  if (declaredSize > 5 * 1024 * 1024) return bad('录音超过 5 MB，请缩短后重试。', 413);
  const audioBuffer = await request.arrayBuffer();
  if (audioBuffer.byteLength < 512) return bad('录音内容过短，请重新录音。', 400);
  if (audioBuffer.byteLength > 5 * 1024 * 1024) return bad('录音超过 5 MB，请缩短后重试。', 413);
  const requestedLanguage = request.headers.get('x-speech-language') || new URL(request.url).searchParams.get('lang') || '';
  const language = ({ 'zh-CN':'zh', 'en-US':'en', 'id-ID':'id', zh:'zh', en:'en', id:'id' })[requestedLanguage] || undefined;
  try {
    const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio: arrayBufferToBase64(audioBuffer), task: 'transcribe', language,
      vad_filter: true, condition_on_previous_text: false,
      initial_prompt: language
        ? '门店库存操作语音，可能包含 STORE001、STORE002、牛奶、黑糖珍珠、调拨、报损、库存。'
        : 'Retail store inventory operation in 中文, English, or Bahasa Indonesia. Terms may include STORE001, STORE002, 牛奶, milk, susu, 黑糖珍珠, transfer, pindahkan, stock, stok.'
    });
    const transcript = String(result?.text || result?.transcription_info?.text || '').trim();
    if (!transcript) return bad('没有识别到有效语音，请靠近麦克风后重试。', 422);
    const detectedLanguage = String(result?.transcription_info?.language || result?.language || language || 'auto');
    return json({ transcript, language: detectedLanguage, model: '@cf/openai/whisper-large-v3-turbo', retained: false });
  } catch (error) {
    console.error('Voice transcription failed', error instanceof Error ? error.message : String(error));
    return bad('语音转写服务暂时不可用，请重试或使用文字输入。', 502);
  }
}

function r2StateView(value, view = '') {
  const importSummary = value.feishuImport ? {
    id: value.feishuImport.id, imported_at: value.feishuImport.imported_at,
    latest_business_date: value.feishuImport.latest_business_date,
    latest_records: value.feishuImport.latest_records, latest_sales_qty: value.feishuImport.latest_sales_qty
  } : null;
  if (view === 'count-plans') return { countPlans: value.countPlans || [], materialCatalog: value.materialCatalog || [], storeMasters: value.storeMasters || [], feishuImport: importSummary, storage: value.storage };
  if (view === 'documents') return { storeMasters: value.storeMasters || [], materialEvents: value.materialEvents || [], transferOrders: value.transferOrders || [], purchaseOrders: value.purchaseOrders || [], receiptOrders: value.receiptOrders || [], storage: value.storage };
  if (view === 'procurement') return { storeMasters: value.storeMasters || [], materialCatalog: value.materialCatalog || [], purchaseOrders: value.purchaseOrders || [], receiptOrders: value.receiptOrders || [], storage: value.storage };
  if (view === 'materials-evidence') return { countPlans: value.countPlans || [], documents: (value.documents || []).map(({ preview_data, ...item }) => item), storage: value.storage };
  return {
    ...value,
    feishuImport: importSummary,
    documents: (value.documents || []).map((item, index) => index < 5 ? item : (({ preview_data, ...rest }) => rest)(item)),
    countPhotoReviews: (value.countPhotoReviews || []).map(({ preview_data, ...item }) => item),
    diagnosisKnowledge: (value.diagnosisKnowledge || []).map(({ content_markdown, ...item }) => item),
    storeAgentSessions: [],
    demoDaySessions: (value.demoDaySessions || []).map(({ locked_import, ...item }) => item),
    audits: (value.audits || []).slice(0, 200)
  };
}

function r2FeishuStateView(value, view = '') {
  if (!view) return value;
  const common = {
    latestBatch: value.latestBatch, coverage: value.coverage, mapping: value.mapping,
    selectedStore: value.selectedStore, latestGroup: value.latestGroup, storage: value.storage,
    r2Import: value.r2Import ? { id: value.r2Import.id, imported_at: value.r2Import.imported_at, latest_business_date: value.r2Import.latest_business_date } : null
  };
  const slimLedger = (rows, mode) => (rows || []).map((row) => {
    const base = { material_name: row.material_name, unit: row.unit, theoretical_closing_qty: row.theoretical_closing_qty, safety_qty: row.safety_qty ?? null };
    if (mode === 'events') return { ...base, opening_qty: row.opening_qty, bom_consumption_qty: row.bom_consumption_qty, actual_inventory_qty: row.actual_inventory_qty, actual_inventory_at: row.actual_inventory_at, actual_inventory_document_id: row.actual_inventory_document_id, actual_vs_theoretical_qty: row.actual_vs_theoretical_qty, baseline_source: row.baseline_source, manual_events: row.manual_events || [], sku_contributors: { length: (row.sku_contributors || []).length } };
    if (mode === 'simulator') return { ...base, manual_events: row.manual_events || [] };
    if (mode === 'ledger') return {
      ...base,
      opening_qty: row.opening_qty, bom_consumption_qty: row.bom_consumption_qty,
      receipt_qty: row.receipt_qty, transfer_in_qty: row.transfer_in_qty,
      scrap_qty: row.scrap_qty, transfer_out_qty: row.transfer_out_qty,
      source_sales_qty: row.source_sales_qty,
      actual_inventory_qty: row.actual_inventory_qty, actual_inventory_at: row.actual_inventory_at,
      actual_inventory_document_id: row.actual_inventory_document_id,
      actual_vs_theoretical_qty: row.actual_vs_theoretical_qty,
      baseline_source: row.baseline_source, manual_events: row.manual_events || [],
      sku_contributors: row.sku_contributors || [], anomaly: row.anomaly || null,
      inventory_label: row.inventory_label || null, evidence_detail: row.evidence_detail || null,
      receipt_evidence_note: row.receipt_evidence_note || null,
      industry_profile: row.industry_profile || null, scrap_source: row.scrap_source || null
    };
    if (mode === 'hq') return { ...base, opening_qty: row.opening_qty, bom_consumption_qty: row.bom_consumption_qty };
    return base;
  });
  const views = (mode) => (value.storeViews || []).map((item) => ({
    store_code: item.store_code, business_date: item.business_date,
    sales_lines: item.sales_lines, sales_qty: item.sales_qty, sales_amount: item.sales_amount,
    ledger: slimLedger(item.ledger, mode)
  }));
  if (view === 'flows') return { ...common, storeViews: views('events') };
  if (view === 'diagnosis') return { ...common, materialAnomalies: value.materialAnomalies || [], operationTasks: value.operationTasks || [], ledgerSnapshots: value.ledgerSnapshots || [], materialEvents: value.materialEvents || [] };
  if (view === 'simulator') return { ...common, storeViews: views('simulator') };
  if (view === 'transfers') return { ...common, storeViews: views('summary'), transfers: value.transfers || {} };
  if (view === 'materials') return { ...common, storeViews: views('summary') };
  if (view === 'ledger') return {
    ...common,
    r2Import: {
      ...common.r2Import,
      sales: (value.r2Import?.sales || []).filter((row) => !common.latestGroup?.business_date || row.business_date === common.latestGroup.business_date)
        .map(({ store_code, business_date, sku_code, product_name, sku_name, sales_qty, sales_amount, created_at }) => ({ store_code, business_date, sku_code, product_name, sku_name, sales_qty, sales_amount, created_at }))
    },
    demoBaseline: value.demoBaseline, hqSummary: value.hqSummary,
    storeViews: views('ledger'), calculation: value.calculation
  };
  if (view === 'hq-inventory') return { ...common, hqSummary: value.hqSummary, storeViews: views('hq') };
  return value;
}

function r2Audit(stateValue, actorRole, action, detail, taskId = null) {
  stateValue.audits.unshift({ task_id: taskId, actor_role: actorRole, action, detail, created_at: now() });
}

function r2AddDocument(stateValue, stage, filename, lines, note, documentType = 'inventory_count', previewData = null, metadata = {}) {
  const document = {
    id: id('PD'), store_code: metadata.store_code || STORE_CODE, business_date: metadata.business_date || null,
    count_plan_no: metadata.count_plan_no || null, stage, document_type: documentType,
    original_filename: filename, ocr_status: 'mock_ocr_completed', ocr_confidence: 0.96,
    note, received_at: now(), preview_data: previewData,
    lines: lines.map((line) => ({
      material_name: line.material, material_code: line.materialCode,
      theoretical_qty: line.expected, actual_qty: line.actual, unit: line.unit,
      match_status: Math.abs(line.actual - line.expected) > r2VarianceThreshold({ material_name: line.material, unit: line.unit, theoretical_closing_qty: line.expected }) ? 'variance' : 'matched',
      ocr_confidence: 0.96
    }))
  };
  stateValue.documents.unshift(document);
  return document;
}

async function r2CreateInitialCount(env, body) {
  const value = await r2DemoState(env);
  const requestedPlanNo = String(body.planNo || body.plan_no || '').trim();
  const dailyPlan = (value.countPlans || []).find((plan) => plan.store_code === STORE_CODE && plan.status === 'pending_store_count' && (!requestedPlanNo || plan.plan_no === requestedPlanNo));
  if (dailyPlan) {
    const actualOverrides = body.actuals && typeof body.actuals === 'object' ? body.actuals : {};
    const lines = (dailyPlan.lines || []).map((line) => ({
      material: line.material_name, materialCode: line.material_code || normalizedKey(line.material_name).toUpperCase(),
      expected: Number(line.theoretical_qty || 0), actual: Number(actualOverrides[`${line.material_name}|${line.unit}`] ?? actualOverrides[line.material_name] ?? (line.theoretical_qty || 0)), unit: line.unit
    }));
    if (!lines.length) return bad('该每日盘点计划未包含物料明细，请由总部重新生成计划。', 409);
    const recognitionLabel = body.recognition_note === 'ark_vision' ? 'LLM 图片识别后由门店确认' : body.recognition_note ? '照片识别结果由门店确认' : '门店手工确认';
    const document = r2AddDocument(value, 'daily-plan', body.filename || '每日物料盘点单.jpg', lines, `${recognitionLabel}：已提交 ${lines.length} 项计划物料，理论库存快照保留在盘点单中。`, 'inventory_count', validPreviewData(body.previewData), { store_code: dailyPlan.store_code, business_date: dailyPlan.business_date, count_plan_no: dailyPlan.plan_no });
    r2LinkOperationDocument(value, String(body.operationTaskId || body.operation_task_id || ''), document.id, '关联盘点单');
    if (value.feishuImport?.sales?.length) r2ReconcileAllMaterialSignalsAndCases(value, value.feishuImport.latest_business_date, document.received_at);
    const submittedPlan = r2MarkCountPlanSubmission(value, STORE_CODE, document, dailyPlan.plan_no);
    r2Audit(value, '门店', '完成每日盘点任务', `${submittedPlan.plan_no} 已提交全量 ${submittedPlan.submitted_material_count}/${submittedPlan.material_count} 项；总部状态已更新为待复核。`, submittedPlan.id);
    return r2Result(await r2SaveDemoState(env, value, 'daily-plan-count'), 201);
  }
  if (value.task && value.task.status !== 'closed') return bad('当前已有未闭环的盘点任务，请先完成复盘。', 409);
  const lines = [{ ...STOCK_STANDARD[0], actual: 8 }, { ...STOCK_STANDARD[1], actual: 40.8 }, { ...STOCK_STANDARD[2], actual: 1305 }];
  const document = r2AddDocument(value, 'initial', body.filename || '门店盘点单.jpg', lines, '演示 OCR：已识别 3 个物料', 'inventory_count', validPreviewData(body.previewData));
  r2MarkCountPlanSubmission(value, STORE_CODE, document);
  const milk = lines[0];
  const task = {
    id: id('TASK'), judgment_task_no: id('JDG'), store_code: STORE_CODE, document_id: document.id, material_name: milk.material,
    theoretical_qty: milk.expected, initial_qty: milk.actual, unit: milk.unit, severity: 'high',
    status: 'pending_hq_decision', assigned_to: '总部运营', created_at: document.received_at,
    diagnosis: `理论库存 ${milk.expected}${milk.unit}，首次盘点 ${milk.actual}${milk.unit}，差异 ${Math.abs(milk.actual - milk.expected).toFixed(1)}${milk.unit}（73%）。门店首次盘点已完成，等待总部判断是否需要复盘。`
  };
  value.task = task;
  r2Audit(value, '门店', '提交首次盘点单', `已提交 ${document.original_filename}；演示 OCR 识别 3 个物料。`, task.id);
  r2Audit(value, '规则引擎', '生成盘点异常', '牛奶盘点差异超过 20%，已生成异常，等待总部决定是否要求门店单独复盘。', task.id);
  return r2Result(await r2SaveDemoState(env, value, 'initial-count'), 201);
}

function r2CountPhotoLines(plan, rawLines = []) {
  const supplied = Array.isArray(rawLines) ? rawLines : [];
  return (plan.lines || []).map((line) => {
    const candidate = supplied.find((item) => normalizedKey(item?.material_name || item?.material || '') === normalizedKey(line.material_name));
    const actual = Number(candidate?.actual_qty ?? candidate?.qty ?? candidate?.actual);
    const confidence = Number(candidate?.confidence);
    const usable = Number.isFinite(actual) && actual >= 0;
    return {
      material_name: line.material_name,
      unit: line.unit,
      theoretical_qty: Number(line.theoretical_qty || 0),
      actual_qty: usable ? r2Round(actual) : null,
      confidence: usable && Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
      status: usable && confidence >= 0.82 ? 'recognized' : 'needs_confirmation'
    };
  });
}

async function r2RecognizeCountPhotoWithArk(env, previewData, plan) {
  if (!env.DOUBAO_API_KEY || !previewData) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const targetLines = (plan.lines || []).map((line) => `${line.material_name}（${line.unit}）`).join('、');
    const response = await fetch(R2_ARK_CHAT_COMPLETIONS, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${env.DOUBAO_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.DOUBAO_VISION_MODEL || env.DOUBAO_MODEL || R2_ARK_STORE_AGENT_MODEL,
        temperature: 0,
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '你是门店盘点单图片识别助手。只读取图片中明确可见的物料和数量；不猜测、不补齐。只输出 JSON：{"lines":[{"material_name":"","actual_qty":数字或null,"confidence":0到1}]}。物料必须从给定清单中精确选择；看不清则 actual_qty 为 null。' },
          { role: 'user', content: [{ type: 'text', text: `请识别这张盘点单。允许的物料：${targetLines}` }, { type: 'image_url', image_url: { url: previewData } }] }
        ]
      })
    });
    if (!response.ok) return null;
    const content = (await response.json())?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(String(content).replace(/^```json\s*|\s*```$/g, ''));
    return r2CountPhotoLines(plan, parsed?.lines);
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function r2CreateCountPhotoReview(env, body = {}) {
  const value = await r2DemoState(env);
  const planNo = String(body.planNo || body.plan_no || '').trim().slice(0, 120);
  const plan = (value.countPlans || []).find((item) => item.plan_no === planNo && item.store_code === STORE_CODE && item.status === 'pending_store_count');
  if (!plan) return bad('未找到待完成的盘点任务，请刷新后重试。', 404);
  const filename = String(body.filename || '').trim().slice(0, 160);
  const previewData = validPreviewData(body.previewData);
  if (!filename || !previewData) return bad('请上传一张 JPG、PNG 或 WebP 盘点照片。');
  const recognized = await r2RecognizeCountPhotoWithArk(env, previewData, plan);
  const lines = recognized || r2CountPhotoLines(plan, []);
  const review = {
    id: id('OCR'), plan_no: plan.plan_no, store_code: plan.store_code, business_date: plan.business_date,
    filename, preview_data: previewData, created_at: now(), engine: recognized ? 'ark_vision' : 'photo_archive_pending_confirmation',
    lines,
    recognized_count: lines.filter((line) => line.status === 'recognized').length,
    needs_confirmation_count: lines.filter((line) => line.status !== 'recognized').length
  };
  value.countPhotoReviews = (value.countPhotoReviews || []).filter((item) => item.plan_no !== plan.plan_no);
  value.countPhotoReviews.unshift(review);
  r2Audit(value, '门店', '上传盘点照片', `${plan.plan_no} · ${filename} 已归档；${review.recognized_count}/${lines.length} 项可自动识别，其余需人工确认。`, plan.id);
  const state = await r2SaveDemoState(env, value, 'count-photo-recognition');
  return json({ review: { ...review, preview_data: undefined }, state }, 201);
}

async function r2ConfirmCountPhotoReview(env, body = {}) {
  const value = await r2DemoState(env);
  const reviewId = String(body.reviewId || body.review_id || '').trim().slice(0, 120);
  const review = (value.countPhotoReviews || []).find((item) => item.id === reviewId);
  if (!review) return bad('盘点照片识别结果不存在，请重新上传。', 404);
  const plan = (value.countPlans || []).find((item) => item.plan_no === review.plan_no && item.status === 'pending_store_count');
  if (!plan) return bad('该盘点任务已完成或已失效，请刷新页面。', 409);
  const corrections = body.actuals && typeof body.actuals === 'object' ? body.actuals : {};
  const actuals = {};
  for (const line of review.lines || []) {
    const key = `${line.material_name}|${line.unit}`;
    const candidate = corrections[key] ?? corrections[line.material_name] ?? line.actual_qty;
    const actual = Number(candidate);
    if (!Number.isFinite(actual) || actual < 0) return bad(`请确认 ${line.material_name} 的实际数量。`);
    actuals[key] = actual;
  }
  const result = await r2CreateInitialCount(env, { planNo: review.plan_no, filename: review.filename, previewData: review.preview_data, actuals, recognition_note: review.engine });
  return result;
}

async function r2CreateSupportingDocument(env, body) {
  const value = await r2DemoState(env);
  const type = body.documentType === 'receipt' ? 'receipt' : 'scrap';
  const copy = type === 'receipt'
    ? { filename: '收货单.jpg', note: '演示 OCR：已识别入库单号、收货日期与 3 项物料' }
    : { filename: '报废单.jpg', note: '演示 OCR：已识别报废原因、报废日期与 2 项物料' };
  const document = r2AddDocument(value, 'initial', body.filename || copy.filename, [], copy.note, type, validPreviewData(body.previewData));
  r2LinkOperationDocument(value, String(body.operationTaskId || body.operation_task_id || ''), document.id, '关联处理凭证');
  return r2Result(await r2SaveDemoState(env, value, `document-${type}`), 201);
}

async function r2SubmitRecheck(env, body) {
  const value = await r2DemoState(env);
  const task = value.task;
  if (!task || task.status !== 'pending_store_recount') return bad('没有等待门店复盘的任务。', 409);
  const line = { ...STOCK_STANDARD[0], actual: 29.1 };
  const document = r2AddDocument(value, 'recheck', body.filename || '牛奶复盘单.jpg', [line], '演示 OCR：已识别牛奶复盘数量', 'inventory_count', validPreviewData(body.previewData));
  task.recheck_qty = line.actual;
  task.status = 'pending_hq_review';
  task.diagnosis = `复盘数量 ${line.actual}${line.unit}，与理论库存差异 ${Math.abs(line.actual - line.expected).toFixed(1)}${line.unit}；首次盘点疑似少录数字，待总部确认。`;
  r2Audit(value, '门店', '提交复盘凭证', `已提交 ${document.original_filename}；演示 OCR 识别牛奶 ${line.actual}${line.unit}。`, task.id);
  r2Audit(value, '规则引擎', '转总部复核', task.diagnosis, task.id);
  return r2Result(await r2SaveDemoState(env, value, 'recheck-submit'));
}

async function r2TaskTransition(env, taskId, action) {
  const value = await r2DemoState(env);
  const task = value.task;
  if (!task || task.id !== taskId) return bad('任务不存在。', 404);
  if (action === 'request-recount') {
    if (task.status !== 'pending_hq_decision') return bad('该异常当前不能要求复盘。', 409);
    task.status = 'pending_store_recount'; task.assigned_to = 'STORE001 店长';
    task.diagnosis = `总部要求门店单独复盘${task.material_name}：理论 ${task.theoretical_qty}${task.unit}，首次盘点 ${task.initial_qty}${task.unit}，请核对是否录入错误或真实短缺。`;
    r2Audit(value, '总部运营', '要求门店复盘', task.diagnosis, task.id);
  } else if (action === 'end-audit') {
    if (task.status !== 'pending_hq_decision') return bad('该异常当前不能结束审核。', 409);
    task.status = 'closed'; task.closed_at = now(); task.resolution = '总部结束审核：本次不要求门店复盘，保留首次盘点和异常审计记录。';
    r2Audit(value, '总部运营', '结束审核', task.resolution, task.id);
  } else {
    if (task.status !== 'pending_hq_review') return bad('该任务尚未收到门店复盘，暂不能关闭。', 409);
    task.status = 'closed'; task.closed_at = now(); task.resolution = '总部已复核：复盘数量接近理论库存，首次盘点疑似录入错误；不调整库存台账，保留审计记录。';
    r2Audit(value, '总部运营', '复核并关闭', task.resolution, task.id);
  }
  return r2Result(await r2SaveDemoState(env, value, action));
}

async function r2CreateOperationTask(env, body) {
  const value = await r2DemoState(env);
  const sourceAnomalyId = String(body.sourceAnomalyId || '').trim().slice(0, 80);
  if (sourceAnomalyId && value.operationTasks.some((task) => task.source_anomaly_id === sourceAnomalyId && task.status !== 'closed')) return bad('该研判已有进行中的执行任务。', 409);
  const title = String(body.title || '冷藏温度巡检').trim().slice(0, 40);
  const instruction = String(body.instruction || '请在开店前检查冷藏设备温度是否处于 0–4°C，拍摄温度计或设备面板作为凭证后提交。').trim().slice(0, 240);
  if (!title || !instruction) return bad('请填写任务名称和执行要求。');
  const storeCode = String(body.storeCode || STORE_CODE).trim().slice(0, 64);
  const linkedDocumentIds = Array.isArray(body.linkedDocumentIds) ? body.linkedDocumentIds.map((item) => String(item).slice(0, 80)).filter(Boolean).slice(0, 20) : [];
  const task = { id: id('OPT'), store_code: storeCode, task_type: String(body.taskType || 'custom').slice(0, 40), title, instruction, status: 'pending_store_submission', assigned_to: `${storeCode} 店长`, created_at: now(), source_anomaly_id: sourceAnomalyId || null, source_rule_code: String(body.sourceRuleCode || '').slice(0, 40) || null, linked_document_ids: [...new Set(linkedDocumentIds)], linked_event_ids: [] };
  value.operationTasks.unshift(task); value.operationTask = task;
  r2Audit(value, '', '创建跟进工单', `${task.id} · ${task.title}`, task.id);
  return r2Result(await r2SaveDemoState(env, value, 'operation-create'), 201);
}

async function r2AddOperationTaskNote(env, taskId, body) {
  const value = await r2DemoState(env);
  const task = (value.operationTasks || []).find((item) => item.id === taskId);
  if (!task) return bad('跟进工单不存在。', 404);
  const note = String(body.note || '').trim().slice(0, 500);
  const operator = String(body.operator || '').trim().slice(0, 80);
  if (!note) return bad('请填写处理记录。');
  const entry = { id: id('LOG'), type: 'progress_note', note, operator: operator || null, created_at: now(), source: 'manual' };
  task.activity_log = [...(task.activity_log || []), entry];
  task.updated_at = entry.created_at;
  task.last_operator = operator || null;
  r2Audit(value, operator, '更新工单进展', note, task.id);
  value.operationTask = task;
  return r2Result(await r2SaveDemoState(env, value, 'operation-note'));
}

function r2CurrentTaskDiagnosisV2(value, task) {
  if (!task?.source_anomaly_id || !value.feishuImport?.sales) return null;
  const calculated = r2ImportedFeishuState(value);
  const report = buildDiagnosisShadowReport({
    ...calculated,
    purchaseOrders:value.purchaseOrders || [],
    receiptOrders:value.receiptOrders || [],
    storeTransferRequests:value.storeTransferRequests || []
  }, value.materialCatalog || []);
  const comparison = report.comparisons.find((item) => item.signal_id === task.source_anomaly_id) || null;
  return comparison ? { generated_at:report.generated_at, comparison } : null;
}

function r2DiagnosisRunSnapshot(current, trigger = 'manual') {
  if (!current?.comparison) return null;
  const comparison = current.comparison;
  return {
    id:id('RUN'), trigger, created_at:current.generated_at || now(), ruleset_id:comparison.v2.ruleset_id,
    rule_code:comparison.v2.rule_code, rule_version:comparison.v2.rule_version,
    anomaly_status:comparison.v2.anomaly_status, cause_evidence_status:comparison.v2.cause_evidence_status,
    physical_status:comparison.v2.physical_status, primary_location:comparison.v2.primary_location,
    primary_hypothesis:comparison.v2.primary_hypothesis, evidence_gaps:comparison.v2.evidence_gaps || [],
    recommended_action_ids:comparison.v2.recommended_action_ids || [], fact_packet_id:comparison.fact_packet.fact_packet_id,
    theoretical_closing:comparison.fact_packet.quantities.theoretical_closing,
    physical_count:comparison.fact_packet.physical_count,
    decision_trace:comparison.v2.decision_trace || []
  };
}

async function r2ReassessOperationTask(env, taskId) {
  const value = await r2DemoState(env);
  const task = (value.operationTasks || []).find((item) => item.id === taskId);
  if (!task) return bad('跟进工单不存在。', 404);
  if (!task.source_anomaly_id) return bad('该工单未关联库存研判，不能运行 V2。', 409);
  const current = r2CurrentTaskDiagnosisV2(value, task);
  if (!current) return bad('当前关联研判已关闭或缺少可计算事实，无法重新研判。', 409);
  const run = r2DiagnosisRunSnapshot(current, 'manual_reassess');
  task.diagnosis_runs = [...(task.diagnosis_runs || []), run].slice(-20);
  task.latest_diagnosis_run_id = run.id; task.updated_at = run.created_at;
  task.activity_log = [...(task.activity_log || []), { id:id('LOG'), type:'diagnosis_reassess', note:`V2 重新研判：${run.anomaly_status === 'triggered' ? '异常仍触发' : '异常已恢复'}；首要位置：${run.primary_location}。`, operator:'系统规则引擎', created_at:run.created_at, source:'diagnosis_v2' }];
  r2Audit(value, '系统规则引擎', 'V2 重新研判', `${task.id} · ${run.rule_code} · ${run.anomaly_status} · ${run.primary_location}`, task.id);
  value.operationTask = task;
  await r2SaveDemoState(env, value, 'operation-diagnosis-reassess');
  return json({ task, diagnosis_v2:current, diagnosis_runs:task.diagnosis_runs, storage:value.storage });
}

async function r2OperationTaskDetail(env, taskId) {
  const value = await r2DemoState(env);
  const task = (value.operationTasks || []).find((item) => item.id === taskId);
  if (!task) return bad('跟进工单不存在。', 404);
  const documentIds = new Set([...(task.linked_document_ids || []), task.proof_document_id].filter(Boolean));
  const eventIds = new Set(task.linked_event_ids || []);
  const diagnosisV2 = r2CurrentTaskDiagnosisV2(value, task);
  return json({
    task,
    anomaly: (value.materialAnomalies || []).find((item) => item.id === task.source_anomaly_id) || null,
    documents: [
      ...(value.documents || []).filter((item) => documentIds.has(item.id)),
      ...(value.purchaseOrders || []).filter((item) => documentIds.has(item.id)).map((item) => ({ ...item, document_type:'purchase_order', document_no:item.order_no })),
      ...(value.receiptOrders || []).filter((item) => documentIds.has(item.id)).map((item) => ({ ...item, document_type:'receipt_order', document_no:item.receipt_no }))
    ],
    events: (value.materialEvents || []).filter((item) => eventIds.has(item.id)),
    audits: (value.audits || []).filter((item) => item.task_id === task.id),
    diagnosis_v2:diagnosisV2,
    diagnosis_runs:task.diagnosis_runs || [],
    storage: value.storage
  });
}

function r2LinkOperationDocument(value, operationTaskId, documentId, action = '关联处理单据') {
  if (!operationTaskId || !documentId) return null;
  const task = (value.operationTasks || []).find((item) => item.id === operationTaskId);
  if (!task) return null;
  task.linked_document_ids = [...new Set([...(task.linked_document_ids || []), documentId])];
  task.updated_at = now();
  r2Audit(value, '系统', action, `${task.id} 已关联单据 ${documentId}。`, task.id);
  return task;
}

function r2DiagnosisWorkOrderCopy(signal) {
  const material = `${signal.material_name}（${signal.unit}）`;
  if (signal.rule_code === 'NEGATIVE_THEORETICAL') return { taskType:'diagnosis_negative_inventory', title:`${material} 调拨 / 收货核查`, instruction:`请核对 ${material} 的调拨出库、目标门店签收、收货及订货记录；将盘点、收货或调拨凭证关联至本工单后提交。` };
  if (signal.rule_code === 'COUNT_VARIANCE') return { taskType:'diagnosis_count_variance', title:`${material} 盘点差异复核`, instruction:`请复核 ${material} 的实盘数量、单位、报损与收货记录；将复盘单或相关凭证关联至本工单后提交。` };
  if (signal.rule_code === 'BELOW_SAFETY_STOCK') return { taskType:'diagnosis_safety_stock', title:`${material} 补货 / 调拨跟进`, instruction:`请确认 ${material} 的到货时间或可调拨余量；建立对应收货或调拨单据，并关联至本工单。` };
  return { taskType:'diagnosis_sell_in_ratio', title:`${material} 补货节奏核对`, instruction:`请核对 ${material} 的本期收货、消耗与补货节奏；将核查结论或相关单据关联至本工单。` };
}

async function r2CreateDiagnosisWorkOrder(env, anomalyId) {
  const value = await r2DemoState(env);
  const signal = (value.materialAnomalies || []).find((item) => item.id === anomalyId && !['closed', 'auto_closed'].includes(item.status));
  if (!signal) return bad('未找到可建立工单的库存研判。', 404);
  const existing = (value.operationTasks || []).find((item) => item.source_anomaly_id === signal.id && item.status !== 'closed');
  if (existing) return json({ ...normalizeR2DemoState(value), operationTask: existing });
  const copy = r2DiagnosisWorkOrderCopy(signal);
  const sourceDocumentId = signal.evidence_detail?.actual_count_document_id || null;
  const createdAt = now();
  const task = {
    id: id('OPT'), store_code: signal.store_code, task_type: copy.taskType, title: copy.title, instruction: copy.instruction,
    status: 'pending_store_submission', assigned_to: `${signal.store_code} 店长`, created_at: createdAt, updated_at: createdAt,
    source_anomaly_id: signal.id, source_rule_code: signal.rule_code,
    linked_document_ids: sourceDocumentId ? [sourceDocumentId] : [], linked_event_ids: []
  };
  const firstRun = r2DiagnosisRunSnapshot(r2CurrentTaskDiagnosisV2(value, task), 'work_order_created');
  if (firstRun) { task.diagnosis_runs = [firstRun]; task.latest_diagnosis_run_id = firstRun.id; }
  value.operationTasks.unshift(task); value.operationTask = task;
  r2Audit(value, '总部运营', '建立库存研判跟进工单', `${task.id} · ${signal.judgment_task_no || signal.id} · ${copy.title}`, task.id);
  return r2Result(await r2SaveDemoState(env, value, 'diagnosis-work-order-create'), 201);
}

async function r2OperationTransition(env, taskId, body, action) {
  const value = await r2DemoState(env);
  const task = value.operationTasks.find((item) => item.id === taskId);
  if (!task) return bad('主动运营任务不存在。', 404);
  if (action === 'submit') {
    if (task.status !== 'pending_store_submission') return bad('该任务当前不能重复提交。', 409);
    const document = r2AddDocument(value, 'initial', body.filename || '门店巡检凭证.jpg', [], '演示 OCR：已归档门店主动任务凭证，等待总部验收。', 'operation_proof', validPreviewData(body.previewData));
    task.status = 'pending_hq_review'; task.proof_filename = body.filename || '冷藏温度巡检照片.jpg'; task.proof_document_id = document.id; task.submitted_at = now();
    r2LinkOperationDocument(value, task.id, document.id, '关联门店提交凭证');
    r2Audit(value, '', '门店提交工单凭证', `${task.proof_filename} · 等待总部确认`, task.id);
  } else {
    if (task.status !== 'pending_hq_review') return bad('该任务尚未收到门店凭证，暂不能关闭。', 409);
    task.status = 'closed'; task.closed_at = now(); task.resolution = `总部已验收：${task.title}的门店凭证已提交，本次任务完成。`;
    r2Audit(value, '', '验收并关闭工单', task.resolution, task.id);
    const sourceCase = (value.diagnosisCases || []).find((item) => item.id === task.source_case_id);
    if (sourceCase && task.task_type === 'receipt_evidence') {
      const names = new Set((task.material_names || []).map(normalizedKey));
      for (const signal of (value.materialAnomalies || []).filter((item) => (sourceCase.signal_ids || []).includes(item.id) && names.has(normalizedKey(item.material_name)))) {
        signal.evidence_detail = { ...(signal.evidence_detail || {}), receipt_status: 'provided_by_store', receipt_note: `门店已通过任务 ${task.id} 补充收货凭证，总部已验收；待下一次台账回算匹配正式入库流水。` };
      }
      sourceCase.guide_review = r2DiagnosisReview(value, sourceCase); sourceCase.updated_at = task.closed_at;
      r2Audit(value, '研判处理向导', '收货凭证验收后继续原工单', `${sourceCase.case_no} · ${task.id} 已验收；下一步：${sourceCase.guide_review.next_action.label}。`, sourceCase.id);
    }
    const sourceMaterial = value.materialAnomalies.find((item) => item.id === task.source_anomaly_id && !['closed', 'auto_closed'].includes(item.status));
    if (sourceMaterial) {
      sourceMaterial.status = 'closed'; sourceMaterial.closed_at = task.closed_at; sourceMaterial.updated_at = task.closed_at;
      sourceMaterial.closure_reason = `关联执行任务 ${task.id} 已验收：${task.resolution}`;
      r2Audit(value, '总部运营', '完成物料研判闭环', `${sourceMaterial.judgment_task_no || sourceMaterial.id} 已随 ${task.id} 闭环。`, sourceMaterial.id);
    }
  }
  value.operationTask = value.operationTasks[0] || null;
  return r2Result(await r2SaveDemoState(env, value, `operation-${action}`));
}

async function r2Governance(env, taskId, body, action) {
  const value = await r2DemoState(env);
  if (action === 'create') {
    const sourceAnomalyId = String(body.sourceAnomalyId || '').slice(0, 80);
    if (sourceAnomalyId && value.governanceTasks.some((task) => task.source_anomaly_id === sourceAnomalyId && task.status !== 'closed')) return bad('该异常已有进行中的总部治理工单。', 409);
    const task = { id: id('GOV'), source_anomaly_id: sourceAnomalyId || null, title: String(body.title || 'SKU BOM 维护工单').trim().slice(0, 60), instruction: String(body.instruction || '补齐 SKU BOM、单位和物料映射，并重新运行理论消耗校验。').trim().slice(0, 300), owner: String(body.owner || '商品 / 数据治理').trim().slice(0, 60), status: 'pending', created_at: now() };
    value.governanceTasks.unshift(task);
    return r2Result(await r2SaveDemoState(env, value, 'governance-create'), 201);
  }
  const task = value.governanceTasks.find((item) => item.id === taskId);
  if (!task) return bad('总部治理工单不存在。', 404);
  if (task.status !== 'pending') return bad('该总部治理工单已完成。', 409);
  task.status = 'closed'; task.closed_at = now(); task.resolution = '总部已完成主数据治理，并已安排重新校验受影响 SKU。';
  return r2Result(await r2SaveDemoState(env, value, 'governance-close'));
}

async function r2CloseAnomaly(env, anomalyId, body) {
  const value = await r2DemoState(env);
  const reason = String(body.reason || '总部研判后确认：已通知门店或当前为消息 / 数据延迟，本次结束研判并保留审计记录。').trim().slice(0, 240);
  const closedAt = now();
  const material = value.materialAnomalies.find((item) => item.id === anomalyId);
  if (material) {
    material.status = 'closed'; material.closed_at = closedAt; material.closure_reason = reason; material.updated_at = closedAt;
    return r2Result(await r2SaveDemoState(env, value, 'material-anomaly-close'));
  }
  if (value.task?.id === anomalyId) {
    value.task.status = 'closed'; value.task.closed_at = closedAt; value.task.resolution = reason;
    r2Audit(value, '总部运营', '结束研判', reason, anomalyId);
    return r2Result(await r2SaveDemoState(env, value, 'task-anomaly-close'));
  }
  if (!/^ANM-(?:ST|SKU)-\d{3}$/.test(anomalyId)) return bad('异常编号格式不正确。');
  value.anomalyClosures = value.anomalyClosures.filter((item) => item.anomaly_id !== anomalyId);
  value.anomalyClosures.unshift({ anomaly_id: anomalyId, closure_reason: reason, closed_by: '总部运营', closed_at: closedAt });
  return r2Result(await r2SaveDemoState(env, value, 'anomaly-close'));
}

async function r2SetMvpDiagnosisAction(env, anomalyId, body) {
  const value = await r2DemoState(env);
  const signal = (value.materialAnomalies || []).find((item) => item.id === anomalyId);
  if (!signal) return bad('未找到对应的库存研判。', 404);
  const status = String(body.status || 'completed');
  if (!['completed', 'no_issue'].includes(status)) return bad('不支持的处理标记。');
  const updatedAt = now();
  signal.mvp_action = {
    status,
    label: status === 'completed' ? '已完成' : '排查无异常',
    updated_at: updatedAt,
    updated_by: '总部运营'
  };
  signal.updated_at = updatedAt;
  r2Audit(value, '总部运营', status === 'completed' ? '标记研判动作已完成' : '标记研判排查无异常', `${signal.judgment_task_no || signal.id} · ${signal.store_code} · ${signal.material_name} · ${signal.rule_code}`, signal.id);
  return r2Result(await r2SaveDemoState(env, value, `diagnosis-mvp-action-${status}`));
}

function r2DiagnosisKnowhowList(value) {
  return (value.diagnosisKnowledge || [])
    .filter((item) => item.kind === 'reference_document')
    .map(({ content_markdown, ...item }) => ({ ...item, content_length: String(content_markdown || '').length }));
}

async function r2SaveDiagnosisKnowhow(env, body) {
  const title = String(body.title || '库存异常排查决策树').trim().slice(0, 120);
  const content = String(body.content_markdown || '');
  if (!content.trim()) return bad('Knowhow 内容不能为空。');
  if (content.length > 120000) return bad('Knowhow 内容过长。');
  const value = await r2DemoState(env);
  const updatedAt = now();
  const document = {
    id: 'KNW-DIAGNOSIS-DECISION-TREE-V2',
    kind: 'reference_document',
    title,
    source_filename: String(body.source_filename || '库存异常排查决策树_v2.md').trim().slice(0, 160),
    source: 'user_uploaded',
    scope: 'MVP 四类库存异常研判参考',
    format: 'markdown',
    rule_codes: ['NEGATIVE_THEORETICAL', 'COUNT_VARIANCE', 'BELOW_SAFETY_STOCK', 'SELL_IN_IMBALANCE'],
    content_markdown: content,
    updated_at: updatedAt,
    created_at: (value.diagnosisKnowledge || []).find((item) => item.id === 'KNW-DIAGNOSIS-DECISION-TREE-V2')?.created_at || updatedAt
  };
  value.diagnosisKnowledge = [document, ...(value.diagnosisKnowledge || []).filter((item) => item.id !== document.id)];
  r2Audit(value, '总部运营', '保存研判 Knowhow', `${document.title} 已作为 R2 在线参考文档保存；不用于自动定责或自动下发。`, document.id);
  const state = await r2SaveDemoState(env, value, 'diagnosis-knowhow-save');
  return json({ knowhow: r2DiagnosisKnowhowList(state).find((item) => item.id === document.id), storage: state.storage }, 201);
}

const R2_MATERIAL_EVENT_TYPES = {
  receipt: { label: '收货入库', delta: 1, document: 'RK' },
  scrap: { label: '报损出库', delta: -1, document: 'SC' },
  transfer_in: { label: '调拨入库', delta: 1, document: 'TR' },
  transfer_out: { label: '调拨出库', delta: -1, document: 'TR' }
};

async function r2CreateMaterialEvent(env, body) {
  const value = await r2DemoState(env);
  const type = String(body.type || 'receipt');
  const config = R2_MATERIAL_EVENT_TYPES[type];
  const storeCode = String(body.store_code || STORE_CODE).trim().slice(0, 64);
  const materialName = String(body.material_name || '').trim().slice(0, 80);
  const unit = String(body.unit || '').trim().slice(0, 16);
  const qty = Number(body.qty);
  const businessDate = String(body.business_date || value.feishuImport?.latest_business_date || chinaBusinessDate()).slice(0, 10);
  if (!config) return bad('不支持的库存动作。');
  if (!storeCode || !materialName || !unit || !Number.isFinite(qty) || qty <= 0) return bad('请完整填写门店、物料、单位和大于 0 的数量。');
  const event = {
    id: id('EVT'), document_no: `${config.document}-${businessDate.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
    store_code: storeCode, business_date: businessDate, material_name: materialName, unit, type, qty: r2Round(qty),
    reference: String(body.reference || '').trim().slice(0, 80) || null, created_at: now(), status: 'active', demo: true
  };
  value.materialEvents.unshift(event);
  const operationTaskId = String(body.operationTaskId || body.operation_task_id || '').trim();
  const task = operationTaskId ? (value.operationTasks || []).find((item) => item.id === operationTaskId) : null;
  if (task) {
    task.linked_event_ids = [...new Set([...(task.linked_event_ids || []), event.id])];
    task.updated_at = now();
    r2Audit(value, '系统', '关联库存流水', `${task.id} 已关联库存流水 ${event.document_no}。`, task.id);
  }
  r2Audit(value, '库存动作模拟器', config.label, `${storeCode} · ${materialName} ${config.delta > 0 ? '+' : '−'}${event.qty}${unit} · ${event.document_no}${event.reference ? ` · ${event.reference}` : ''}`, event.id);
  if (value.feishuImport?.sales?.length) {
    r2ReconcileAllMaterialSignalsAndCases(value, businessDate, now());
  }
  return r2Result(await r2SaveDemoState(env, value, `material-event-${type}`), 201);
}

async function r2RevertMaterialEvent(env, eventId) {
  const value = await r2DemoState(env);
  const event = value.materialEvents.find((item) => item.id === eventId && item.status === 'active');
  if (!event) return bad('库存动作不存在，或已被撤销。', 404);
  event.status = 'reverted'; event.reverted_at = now();
  r2Audit(value, '库存动作模拟器', '撤销库存动作', `${event.document_no} · ${event.material_name} 已撤销，理论库存已回算。`, event.id);
  if (value.feishuImport?.sales?.length) {
    r2ReconcileAllMaterialSignalsAndCases(value, value.feishuImport.latest_business_date, now());
  }
  return r2Result(await r2SaveDemoState(env, value, 'material-event-revert'));
}

async function r2CreateMaterialTransfer(env, body) {
  const value = await r2DemoState(env);
  if (!value.feishuImport?.sales?.length) return bad('请先完成销售数据同步后再创建跨店调拨。', 409);
  const fromStore = String(body.from_store_code || '').trim();
  const toStore = String(body.to_store_code || '').trim();
  const materialName = String(body.material_name || '').trim();
  const unit = String(body.unit || '').trim();
  const qty = r2Round(Number(body.qty));
  if (!fromStore || !toStore || fromStore === toStore || !materialName || !unit || !Number.isFinite(qty) || qty <= 0) return bad('调拨门店、物料、单位和数量不完整。');
  const calculated = r2ImportedFeishuState(value), businessDate = value.feishuImport.latest_business_date;
  const sourceView = (calculated.storeViews || []).find((item) => item.store_code === fromStore);
  const targetView = (calculated.storeViews || []).find((item) => item.store_code === toStore);
  const match = (row) => normalizedKey(row.material_name) === normalizedKey(materialName) && row.unit === unit;
  const source = sourceView?.ledger.find(match), target = targetView?.ledger.find(match);
  if (!source || !target) return bad('调拨双方必须均已建立该物料台账，才能保证回算口径一致。', 409);
  const available = r2Round(Number(source.theoretical_closing_qty || 0) - Number(source.safety_qty || 0));
  if (available < qty) return bad(`调出门店可调余量不足：当前最多可调 ${available}${unit}。`, 409);
  const documentNo = `TR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, createdAt = now();
  const base = { document_no: documentNo, business_date: businessDate, material_name: materialName, unit, qty, created_at: createdAt, status: 'active', demo: true, transfer_pair: true };
  const outbound = { ...base, id: id('EVT'), store_code: fromStore, type: 'transfer_out', reference: `调拨至 ${toStore}` };
  const inbound = { ...base, id: id('EVT'), store_code: toStore, type: 'transfer_in', reference: `调拨自 ${fromStore}` };
  value.materialEvents.unshift(inbound, outbound);
  r2Audit(value, '库存动作模拟器', '跨门店调拨', `${documentNo} · ${materialName} ${qty}${unit} · ${fromStore} → ${toStore}`, documentNo);
  r2ReconcileAllMaterialSignalsAndCases(value, businessDate, createdAt);
  return r2Result(await r2SaveDemoState(env, value, 'material-transfer'), 201);
}

function r2TransferArchive(event, { order = null, request = null, requestedQty = null, actualQty = null, status = '已归档' } = {}) {
  return {
    id: id('ARC'), archive_type: 'store_inventory_flow', document_no: event.document_no,
    order_no: order?.order_no || request?.order_no || event.document_no,
    transfer_request_no: request?.request_no || null, transfer_order_id: order?.id || event.transfer_order_id || null,
    business_date: event.business_date, store_code: event.store_code, counterparty: event.type === 'transfer_out' ? (order?.destinations || []).map((item) => item.store_code).join('、') : (request?.from_store_code || order?.from_party || '—'),
    direction: event.type === 'transfer_out' ? '调出' : '调入', material_name: event.material_name, unit: event.unit,
    requested_qty: requestedQty == null ? event.qty : requestedQty, actual_qty: actualQty == null ? event.qty : actualQty,
    status, source: event.source || 'system_transfer', event_id: event.id, created_at: event.created_at
  };
}

async function r2CreateTransferOrder(env, body) {
  const value = await r2DemoState(env);
  if (!value.feishuImport?.sales?.length) return bad('请先完成飞书销售同步，才能创建调拨单。', 409);
  const fromType = ['hq_warehouse', 'franchise_hub', 'store'].includes(body.from_type) ? body.from_type : 'hq_warehouse';
  const fromParty = String(body.from_party || '').trim().slice(0, 80);
  const materialName = String(body.material_name || '').trim().slice(0, 80);
  const unit = String(body.unit || '').trim().slice(0, 16);
  const businessDate = String(body.business_date || value.feishuImport.latest_business_date || chinaBusinessDate()).slice(0, 10);
  const destinations = (Array.isArray(body.destinations) ? body.destinations : []).map((item) => ({ store_code: String(item.store_code || '').trim().slice(0, 64), qty: r2Round(Number(item.qty)) })).filter((item) => item.store_code && Number.isFinite(item.qty) && item.qty > 0);
  if (!fromParty || !materialName || !unit || !destinations.length) return bad('请填写调出方、物料、单位，以及至少一个调入门店和数量。');
  if (fromType === 'store' && destinations.some((item) => item.store_code === fromParty)) return bad('门店调出方不能同时是调入方。');
  const calculated = r2ImportedFeishuState(value), stores = calculated.storeViews || [];
  if (destinations.some((item) => !stores.some((store) => store.store_code === item.store_code))) return bad('调入门店尚未建立物料台账；请先同步该门店销售并完成首日盘点。', 409);
  const totalQty = r2Round(destinations.reduce((sum, item) => sum + item.qty, 0));
  if (fromType === 'store') {
    const source = stores.find((store) => store.store_code === fromParty)?.ledger.find((row) => normalizedKey(row.material_name) === normalizedKey(materialName) && row.unit === unit);
    if (!source) return bad('调出门店没有此物料台账，不能创建调拨。', 409);
    const available = r2Round(Number(source.theoretical_closing_qty || 0) - Number(source.safety_qty || 0));
    if (available < totalQty) return bad(`调出门店可调余量不足：当前最多可调 ${available}${unit}。`, 409);
  }
  const orderNo = `TR-${businessDate.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, createdAt = now();
  const order = { id: id('TRF'), order_no: orderNo, business_date: businessDate, from_type: fromType, from_party: fromParty, material_name: materialName, unit, total_qty: totalQty, destinations: destinations.map((item, index) => ({ id: id('TRD'), line_no: index + 1, store_code: item.store_code, requested_qty: item.qty, received_qty: null, status: 'pending_receipt' })), status: 'pending_receipt', created_at: createdAt, source: 'hq_console' };
  const outbound = fromType === 'store' ? { id: id('EVT'), document_no: orderNo, store_code: fromParty, business_date: businessDate, material_name: materialName, unit, qty: totalQty, type: 'transfer_out', status: 'active', demo: true, transfer_order_id: order.id, source: 'transfer_outbound', reference: `调拨至 ${destinations.map((item) => item.store_code).join('、')}`, created_at: createdAt } : null;
  const requests = order.destinations.map((destination) => ({ id: id('TRQ'), request_no: `${orderNo}-${String(destination.line_no).padStart(2, '0')}`, parent_order_id: order.id, order_no: orderNo, from_store_code: fromParty, from_type: fromType, to_store_code: destination.store_code, business_date: businessDate, material_name: materialName, unit, qty: destination.requested_qty, actual_received_qty: null, note: null, status: 'pending_receipt', source: 'hq_console', created_at: createdAt, outbound_event_id: outbound?.id || null }));
  value.transferOrders.unshift(order); value.storeTransferRequests.unshift(...requests); if (outbound) value.materialEvents.unshift(outbound);
  if (outbound) value.transferArchives.unshift(r2TransferArchive(outbound, { order, requestedQty: totalQty, status: '调出已登记' }));
  r2Audit(value, '总部运营', '创建调拨主单', `${orderNo} · ${fromParty} → ${destinations.map((item) => `${item.store_code} ${item.qty}${unit}`).join('、')} · ${materialName}；等待各调入门店按实际收货确认。`, order.id);
  r2ReconcileAllMaterialSignalsAndCases(value, businessDate, createdAt);
  return json({ order, requests, outbound_event: outbound, state: await r2SaveDemoState(env, value, 'transfer-order-create') }, 201);
}

async function r2CreateStoreTransferRequest(env, body) {
  const value = await r2DemoState(env);
  if (!value.feishuImport?.sales?.length) return bad('请先完成销售同步，才能根据物料台账提交调拨申请。', 409);
  const storeCode = String(body.store_code || STORE_CODE).trim().slice(0, 64);
  const materialName = String(body.material_name || '').trim().slice(0, 80);
  const unit = String(body.unit || '').trim().slice(0, 16);
  const businessDate = String(body.business_date || chinaBusinessDate()).slice(0, 10);
  const note = String(body.note || '').trim().slice(0, 160);
  const destinations = (Array.isArray(body.destinations) ? body.destinations : [{ store_code: body.to_store_code, qty: body.qty }]).map((item) => ({ store_code: String(item.store_code || '').trim().slice(0, 64), qty: r2Round(Number(item.qty)) })).filter((item) => item.store_code && Number.isFinite(item.qty) && item.qty > 0);
  if (!storeCode || !materialName || !unit || !destinations.length || destinations.some((item) => item.store_code === storeCode)) return bad('请完整填写调出门店、至少一个调入门店、物料、单位和数量；调出与调入门店不能相同。');
  const latest = r2ImportedFeishuState(value);
  const sourceView = (latest.storeViews || []).find((view) => view.store_code === storeCode);
  const material = sourceView?.ledger.find((row) => normalizedKey(row.material_name) === normalizedKey(materialName) && row.unit === unit);
  if (!material) return bad('该物料尚未建立门店台账，不能提交调拨申请。', 409);
  if (destinations.some((destination) => !(latest.storeViews || []).some((view) => view.store_code === destination.store_code && view.ledger.some((row) => normalizedKey(row.material_name) === normalizedKey(materialName) && row.unit === unit)))) return bad('存在尚未建立该物料台账的调入门店，不能保证回算口径一致。', 409);
  const totalQty = r2Round(destinations.reduce((sum, destination) => sum + destination.qty, 0));
  const available = r2Round(Number(material.theoretical_closing_qty || 0) - Number(material.safety_qty || 0));
  if (available < totalQty) return bad(`可调余量不足：当前最多可调 ${available}${unit}。`, 409);
  const requestNo = `TR-${businessDate.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, createdAt = now();
  const order = { id: id('TRF'), order_no: requestNo, business_date: businessDate, from_type: 'store', from_party: storeCode, material_name: materialName, unit, total_qty: totalQty, destinations: destinations.map((item, index) => ({ id: id('TRD'), line_no: index + 1, store_code: item.store_code, requested_qty: item.qty, received_qty: null, status: 'pending_receipt' })), status: 'pending_receipt', note: note || null, created_at: createdAt, source: 'store_html' };
  const outbound = { id: id('EVT'), document_no: requestNo, store_code: storeCode, business_date: businessDate, material_name: materialName, unit, qty: totalQty, type: 'transfer_out', status: 'active', demo: true, transfer_order_id: order.id, source: 'store_html_outbound', reference: `门店调拨至 ${destinations.map((item) => item.store_code).join('、')}${note ? ` · ${note}` : ''}`, created_at: createdAt };
  const requests = order.destinations.map((destination) => ({ id: id('TRQ'), request_no: `${requestNo}-${String(destination.line_no).padStart(2, '0')}`, parent_order_id: order.id, order_no: requestNo, from_store_code: storeCode, from_type: 'store', to_store_code: destination.store_code, business_date: businessDate, material_name: materialName, unit, qty: destination.requested_qty, actual_received_qty: null, note: note || null, status: 'pending_receipt', source: 'store_html', created_at: createdAt, outbound_event_id: outbound.id }));
  value.transferOrders.unshift(order); value.storeTransferRequests.unshift(...requests);
  value.materialEvents.unshift(outbound);
  value.transferArchives.unshift(r2TransferArchive(outbound, { order, requestedQty: totalQty, status: '调出已登记' }));
  const recalculated = r2ImportedFeishuState(value);
  r2ReconcileAllMaterialSignalsAndCases(value, value.feishuImport.latest_business_date, createdAt);
  r2Audit(value, '调出门店', '提交门店调拨主单', `${requestNo} · ${storeCode} 调出 ${materialName} ${totalQty}${unit} 至 ${destinations.map((item) => `${item.store_code} ${item.qty}${unit}`).join('、')}；已扣减调出门店，等待调入门店按实际收货确认。`, order.id);
  return json({ order, requests, outbound_event: outbound, state: await r2SaveDemoState(env, value, 'store-transfer-submit') }, 201);
}

// 补货申请仅生成系统内申请档案，不会写回飞书，也不会直接增加库存。
async function r2CreateStoreRestockRequest(env, body) {
  if (body.confirmed !== true) return bad('请先确认补货申请后再提交。', 409);
  const value = await r2DemoState(env);
  const storeCode = String(body.store_code || STORE_CODE).trim().slice(0, 64) || STORE_CODE;
  const materialName = String(body.material_name || '').trim().slice(0, 80);
  const unit = String(body.unit || '').trim().slice(0, 12);
  const qty = Number(body.qty);
  if (!materialName || !unit || !Number.isFinite(qty) || qty <= 0) return bad('请填写有效的补货物料、数量和单位。');
  const request = { id: id('RST'), request_no: `RST-${chinaBusinessDate().replaceAll('-', '')}-${String((value.restockRequests || []).length + 1).padStart(3, '0')}`, store_code: storeCode, business_date: String(body.business_date || chinaBusinessDate()), material_name: materialName, unit, qty, urgency: ['normal', 'urgent', 'critical'].includes(body.urgency) ? body.urgency : 'normal', reason: String(body.reason || '门店补货申请').slice(0, 160), status: 'pending_hq_review', created_at: now(), source: 'store_ai_agent' };
  value.restockRequests.unshift(request);
  r2Audit(value, '门店 AI 助手', '提交补货申请', `${request.request_no} · ${storeCode} · ${materialName} ${qty}${unit}，等待总部处理。`, request.id);
  await r2SaveDemoState(env, value, 'store-agent-restock');
  return json({ request }, 201);
}

const PROCUREMENT_URGENCY = new Set(['normal', 'urgent', 'critical']);
const PROCUREMENT_SOURCE_TYPES = new Set(['manual', 'work_order', 'restock_request', 'ai_suggestion']);

function r2ProcurementSource(body = {}) {
  const sourceType = PROCUREMENT_SOURCE_TYPES.has(body.source_type) ? body.source_type : 'manual';
  return {
    source_type: sourceType,
    source_work_order_id: String(body.source_work_order_id || body.operation_task_id || '').trim().slice(0, 120) || null,
    urgency: PROCUREMENT_URGENCY.has(body.urgency) ? body.urgency : 'normal'
  };
}

function r2ProcurementLines(value, rawLines, { allowZero = false } = {}) {
  if (!Array.isArray(rawLines) || !rawLines.length) return { error: '请至少添加一项物料明细。' };
  if (rawLines.length > 80) return { error: '单据物料不能超过 80 项。' };
  const catalog = value.materialCatalog?.length ? value.materialCatalog : r2DefaultMaterialCatalog();
  const seen = new Set();
  const lines = [];
  for (const [index, raw] of rawLines.entries()) {
    const materialName = String(raw.material_name || '').trim().slice(0, 80);
    const master = catalog.find((item) => item.status !== 'inactive' && normalizedKey(item.material_name) === normalizedKey(materialName));
    const unit = String(raw.unit || master?.base_unit || '').trim().slice(0, 16);
    const qty = r2Round(Number(raw.qty ?? raw.ordered_qty ?? raw.received_qty));
    if (!master || !unit || !Number.isFinite(qty) || (allowZero ? qty < 0 : qty <= 0)) return { error: `第 ${index + 1} 项物料、单位或数量无效。` };
    if (unit !== master.base_unit) return { error: `${master.material_name} 必须使用库存基础单位 ${master.base_unit}。` };
    const key = `${normalizedKey(master.material_name)}|${unit}`;
    if (seen.has(key)) return { error: `${master.material_name} 重复，请合并为一行。` };
    seen.add(key);
    lines.push({ id: id('LIN'), line_no: index + 1, material_name: master.material_name, unit, qty });
  }
  return { lines };
}

function r2FindProcurementRecord(value, kind, recordId) {
  const list = kind === 'purchase' ? value.purchaseOrders : value.receiptOrders;
  return (list || []).find((item) => item.id === recordId || item.order_no === recordId || item.receipt_no === recordId);
}

function r2PurchaseStatus(order) {
  const lines = order.lines || [];
  if (!lines.length || order.status === 'draft' || order.status === 'cancelled') return order.status;
  const ordered = lines.reduce((sum, line) => sum + Number(line.ordered_qty || 0), 0);
  const received = lines.reduce((sum, line) => sum + Number(line.received_qty || 0), 0);
  if (received <= 0) return 'pending_receipt';
  if (received + 0.000001 < ordered) return 'partially_received';
  return 'received';
}

async function r2CreatePurchaseOrder(env, body = {}) {
  const value = await r2DemoState(env);
  const storeCode = String(body.store_code || STORE_CODE).trim().slice(0, 64);
  const store = (value.storeMasters || []).find((item) => item.store_code === storeCode && item.status !== '停用');
  if (!store) return bad('请选择有效门店。');
  const parsed = r2ProcurementLines(value, body.lines);
  if (parsed.error) return bad(parsed.error);
  const businessDate = String(body.business_date || chinaBusinessDate()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) return bad('订货日期格式不正确。');
  const source = r2ProcurementSource(body), createdAt = now();
  const order = {
    id: id('PO'), order_no: `PO-${businessDate.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    store_code: storeCode, supplier_name: String(body.supplier_name || '待确认供应商').trim().slice(0, 100),
    business_date: businessDate, expected_arrival_date: String(body.expected_arrival_date || '').slice(0, 10) || null,
    status: 'draft', ...source, note: String(body.note || '').trim().slice(0, 300) || null,
    lines: parsed.lines.map((line) => ({ ...line, ordered_qty: line.qty, received_qty: 0, status: 'pending' })),
    created_at: createdAt, updated_at: createdAt, created_by: String(body.operator || '总部运营').trim().slice(0, 80) || null
  };
  value.purchaseOrders.unshift(order);
  r2LinkOperationDocument(value, order.source_work_order_id, order.id, '关联订货草稿');
  r2Audit(value, order.created_by, '建立订货草稿', `${order.order_no} · ${storeCode} · ${order.lines.length} 项${source.urgency !== 'normal' ? ' · 紧急补货' : ''}`, order.id);
  const state = await r2SaveDemoState(env, value, 'purchase-order-draft');
  return json({ order, storage: state.storage }, 201);
}

async function r2PurchaseOrderAction(env, orderId, action) {
  const value = await r2DemoState(env);
  const order = r2FindProcurementRecord(value, 'purchase', orderId);
  if (!order) return bad('订货单不存在。', 404);
  if (action === 'submit') {
    if (order.status !== 'draft') return bad('只有草稿订货单可以确认提交。', 409);
    order.status = 'pending_receipt'; order.submitted_at = now(); order.updated_at = order.submitted_at;
    r2Audit(value, '总部运营', '确认提交订货单', `${order.order_no} 已提交，等待收货；本动作不增加库存。`, order.id);
  } else if (action === 'cancel') {
    if (!['draft', 'pending_receipt'].includes(order.status)) return bad('该订货单当前不能取消。', 409);
    if ((order.lines || []).some((line) => Number(line.received_qty || 0) > 0)) return bad('已有收货记录的订货单不能取消。', 409);
    order.status = 'cancelled'; order.cancelled_at = now(); order.updated_at = order.cancelled_at;
    r2Audit(value, '总部运营', '取消订货单', `${order.order_no} 已取消；未改动库存。`, order.id);
  }
  const state = await r2SaveDemoState(env, value, `purchase-order-${action}`);
  return json({ order, storage: state.storage });
}

async function r2CreateReceiptOrder(env, body = {}) {
  const value = await r2DemoState(env);
  const purchaseOrderId = String(body.order_id || body.purchase_order_id || '').trim();
  const purchase = purchaseOrderId ? r2FindProcurementRecord(value, 'purchase', purchaseOrderId) : null;
  if (purchaseOrderId && !purchase) return bad('关联订货单不存在。', 404);
  if (purchase && !['pending_receipt', 'partially_received'].includes(purchase.status)) return bad('该订货单当前不能创建收货草稿。', 409);
  const storeCode = String(body.store_code || purchase?.store_code || STORE_CODE).trim().slice(0, 64);
  const store = (value.storeMasters || []).find((item) => item.store_code === storeCode && item.status !== '停用');
  if (!store) return bad('请选择有效门店。');
  if (purchase && storeCode !== purchase.store_code) return bad('收货门店必须与订货单一致。');
  const rawLines = Array.isArray(body.lines) && body.lines.length ? body.lines : (purchase?.lines || []).filter((line) => Number(line.ordered_qty || 0) > Number(line.received_qty || 0)).map((line) => ({ material_name: line.material_name, unit: line.unit, qty: r2Round(Number(line.ordered_qty || 0) - Number(line.received_qty || 0)) }));
  const parsed = r2ProcurementLines(value, rawLines);
  if (parsed.error) return bad(parsed.error);
  if (purchase) {
    for (const line of parsed.lines) {
      const orderedLine = purchase.lines.find((item) => normalizedKey(item.material_name) === normalizedKey(line.material_name) && item.unit === line.unit);
      const remaining = r2Round(Number(orderedLine?.ordered_qty || 0) - Number(orderedLine?.received_qty || 0));
      if (!orderedLine || line.qty > remaining + 0.000001) return bad(`${line.material_name} 收货数量超过订货未收数量 ${remaining}${line.unit}。`, 409);
    }
  }
  const businessDate = String(body.business_date || chinaBusinessDate()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) return bad('收货日期格式不正确。');
  const source = r2ProcurementSource({ ...body, source_work_order_id: body.source_work_order_id || purchase?.source_work_order_id, source_type: body.source_type || purchase?.source_type, urgency: body.urgency || purchase?.urgency });
  const createdAt = now();
  const receipt = {
    id: id('RCV'), receipt_no: `RCV-${businessDate.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    order_id: purchase?.id || null, order_no: purchase?.order_no || null, store_code: storeCode,
    supplier_name: String(body.supplier_name || purchase?.supplier_name || '未关联供应商').trim().slice(0, 100),
    business_date: businessDate, status: 'draft', ...source,
    note: String(body.note || '').trim().slice(0, 300) || null,
    lines: parsed.lines.map((line) => ({ ...line, received_qty: line.qty })),
    created_at: createdAt, updated_at: createdAt, created_by: String(body.operator || '门店').trim().slice(0, 80) || null,
    confirmed_at: null, event_ids: []
  };
  value.receiptOrders.unshift(receipt);
  r2LinkOperationDocument(value, receipt.source_work_order_id, receipt.id, '关联收货草稿');
  r2Audit(value, receipt.created_by, '建立收货草稿', `${receipt.receipt_no} · ${storeCode} · ${receipt.lines.length} 项${receipt.order_no ? ` · 关联 ${receipt.order_no}` : ' · 独立收货'}`, receipt.id);
  const state = await r2SaveDemoState(env, value, 'receipt-order-draft');
  return json({ receipt, storage: state.storage }, 201);
}

async function r2ReceiptOrderAction(env, receiptId, action, body = {}) {
  const value = await r2DemoState(env);
  const receipt = r2FindProcurementRecord(value, 'receipt', receiptId);
  if (!receipt) return bad('收货单不存在。', 404);
  if (action === 'cancel') {
    if (receipt.status !== 'draft') return bad('只有草稿收货单可以取消。', 409);
    receipt.status = 'cancelled'; receipt.cancelled_at = now(); receipt.updated_at = receipt.cancelled_at;
    r2Audit(value, String(body.operator || '门店').slice(0, 80), '取消收货草稿', `${receipt.receipt_no} 已取消；未生成库存流水。`, receipt.id);
  } else if (action === 'confirm') {
    if (receipt.status !== 'draft') return bad('该收货单已确认或已取消，不能重复确认。', 409);
    const purchase = receipt.order_id ? r2FindProcurementRecord(value, 'purchase', receipt.order_id) : null;
    if (receipt.order_id && (!purchase || !['pending_receipt', 'partially_received'].includes(purchase.status))) return bad('关联订货单状态已变化，请刷新后重试。', 409);
    if (purchase) {
      for (const line of receipt.lines || []) {
        const orderedLine = purchase.lines.find((item) => normalizedKey(item.material_name) === normalizedKey(line.material_name) && item.unit === line.unit);
        const remaining = r2Round(Number(orderedLine?.ordered_qty || 0) - Number(orderedLine?.received_qty || 0));
        if (!orderedLine || Number(line.received_qty || 0) > remaining + 0.000001) return bad(`${line.material_name} 的可收数量已经变化，请重新创建收货草稿。`, 409);
      }
    }
    const confirmedAt = now(), events = [];
    for (const line of receipt.lines || []) {
      const event = {
        id: id('EVT'), document_no: receipt.receipt_no, store_code: receipt.store_code, business_date: receipt.business_date,
        material_name: line.material_name, unit: line.unit, type: 'receipt', qty: r2Round(line.received_qty),
        reference: receipt.order_no ? `订货单 ${receipt.order_no} 收货` : (receipt.note || '独立收货'),
        created_at: confirmedAt, status: 'active', demo: true, source: 'receipt_order',
        receipt_order_id: receipt.id, purchase_order_id: receipt.order_id, source_work_order_id: receipt.source_work_order_id
      };
      value.materialEvents.unshift(event); events.push(event);
      if (purchase) {
        const orderedLine = purchase.lines.find((item) => normalizedKey(item.material_name) === normalizedKey(line.material_name) && item.unit === line.unit);
        orderedLine.received_qty = r2Round(Number(orderedLine.received_qty || 0) + Number(line.received_qty || 0));
        orderedLine.status = orderedLine.received_qty + 0.000001 >= orderedLine.ordered_qty ? 'received' : 'partially_received';
      }
    }
    receipt.status = 'received'; receipt.confirmed_at = confirmedAt; receipt.updated_at = confirmedAt;
    receipt.confirmed_by = String(body.operator || '门店').trim().slice(0, 80) || null; receipt.event_ids = events.map((item) => item.id);
    if (purchase) { purchase.status = r2PurchaseStatus(purchase); purchase.updated_at = confirmedAt; if (purchase.status === 'received') purchase.received_at = confirmedAt; }
    if (receipt.source_work_order_id) {
      const task = (value.operationTasks || []).find((item) => item.id === receipt.source_work_order_id);
      if (task) {
        task.linked_document_ids = [...new Set([...(task.linked_document_ids || []), receipt.id])];
        task.linked_event_ids = [...new Set([...(task.linked_event_ids || []), ...events.map((item) => item.id)])];
        task.updated_at = confirmedAt;
      }
    }
    if (value.feishuImport?.sales?.length) r2ReconcileAllMaterialSignalsAndCases(value, value.feishuImport.latest_business_date, confirmedAt);
    r2Audit(value, receipt.confirmed_by, '确认收货并生成库存流水', `${receipt.receipt_no} · ${events.length} 项已入库${receipt.order_no ? ` · 订货单 ${receipt.order_no} 更新为 ${purchase.status}` : ''}。`, receipt.id);
  }
  const state = await r2SaveDemoState(env, value, `receipt-order-${action}`);
  return json({ receipt, purchase_order: receipt.order_id ? r2FindProcurementRecord(state, 'purchase', receipt.order_id) : null, events: action === 'confirm' ? state.materialEvents.filter((item) => receipt.event_ids.includes(item.id)) : [], storage: state.storage });
}

async function r2ProcurementDetail(env, kind, recordId) {
  const value = await r2DemoState(env);
  const record = r2FindProcurementRecord(value, kind, recordId);
  if (!record) return bad(kind === 'purchase' ? '订货单不存在。' : '收货单不存在。', 404);
  const purchase = kind === 'purchase' ? record : (record.order_id ? r2FindProcurementRecord(value, 'purchase', record.order_id) : null);
  return json({
    record, purchase_order: purchase,
    receipts: kind === 'purchase' ? (value.receiptOrders || []).filter((item) => item.order_id === record.id) : [],
    events: kind === 'receipt' ? (value.materialEvents || []).filter((item) => (record.event_ids || []).includes(item.id)) : [],
    audits: (value.audits || []).filter((item) => [record.id, purchase?.id].includes(item.task_id)), storage: value.storage
  });
}

async function r2ReceiveStoreTransferRequest(env, requestId, body = {}) {
  const value = await r2DemoState(env);
  const request = value.storeTransferRequests.find((item) => item.id === requestId);
  if (!request) return bad('门店调拨申请不存在。', 404);
  if (request.status !== 'pending_receipt') return bad('该调拨单已经完成收货，不能重复确认。', 409);
  const receiver = String(body.store_code || request.to_store_code).trim().slice(0, 64);
  if (receiver !== request.to_store_code) return bad('仅调入门店可以确认收货。', 403);
  const actualQty = r2Round(Number(body.actual_qty == null ? request.qty : body.actual_qty));
  if (!Number.isFinite(actualQty) || actualQty < 0) return bad('实际收货数量必须为不小于 0 的数字。');
  const event = {
    id: id('EVT'), document_no: request.request_no, store_code: receiver, business_date: request.business_date,
    material_name: request.material_name, unit: request.unit, qty: actualQty,
    type: 'transfer_in', status: 'active', demo: true, source: 'store_html_receipt', transfer_request_id: request.id,
    reference: `门店调拨自 ${request.from_store_code}${request.note ? ` · ${request.note}` : ''}`,
    created_at: now()
  };
  value.materialEvents.unshift(event);
  request.status = 'received'; request.actual_received_qty = actualQty; request.received_at = now(); request.received_by = receiver; request.inbound_event_id = event.id;
  const order = value.transferOrders.find((item) => item.id === request.parent_order_id || item.order_no === request.order_no || item.order_no === request.request_no);
  if (order) {
    const line = (order.destinations || []).find((item) => item.store_code === receiver && Number(item.requested_qty) === Number(request.qty) && item.status === 'pending_receipt') || (order.destinations || []).find((item) => item.store_code === receiver);
    if (line) { line.status = 'received'; line.received_qty = actualQty; line.received_at = request.received_at; }
    const lines = order.destinations || [];
    order.status = lines.every((item) => item.status === 'received') ? 'completed' : lines.some((item) => item.status === 'received') ? 'partially_received' : 'pending_receipt';
    if (order.status === 'completed') order.completed_at = request.received_at;
  }
  value.transferArchives.unshift(r2TransferArchive(event, { order, request, requestedQty: request.qty, actualQty, status: actualQty === request.qty ? '收货已确认' : '收货差异已记录' }));
  if (value.feishuImport?.sales?.length) {
    r2ReconcileAllMaterialSignalsAndCases(value, value.feishuImport.latest_business_date, now());
  }
  r2Audit(value, '调入门店', '确认调拨收货', `${request.request_no} · ${receiver} 计划 ${request.qty}${request.unit}，实际收货 ${actualQty}${request.unit}，已生成调入流水 ${event.id}${order ? `；主单 ${order.order_no} 当前为${order.status}` : ''}。`, request.id);
  return json({ request, order, event, state: await r2SaveDemoState(env, value, 'store-transfer-receive') });
}

async function r2ResetDemo(env) {
  const initial = cloneDemoState(await r2ReadJson(env.DEMO_STATE, R2_DEMO_INITIAL_KEY) || r2DemoInitialState());
  initial.storage = { provider: 'R2', mode: 'demo-workflow', updatedAt: now(), lastAction: 'reset' };
  return r2Result(await r2SaveDemoState(env, initial, 'reset'));
}

async function r2ResetStoreBusinessDay(env, body = {}) {
  const value = await r2DemoState(env);
  const storeCode = String(body.store_code || STORE_CODE).trim().slice(0, 64);
  const businessDate = String(body.business_date || value.feishuImport?.latest_business_date || chinaBusinessDate()).slice(0, 10);
  if (!storeCode || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) return bad('请提供有效的门店和营业日。');
  const scopedPlans = (value.countPlans || []).filter((item) => item.store_code === storeCode && item.business_date === businessDate);
  const planNos = new Set(scopedPlans.map((item) => item.plan_no));
  const scopedCases = (value.diagnosisCases || []).filter((item) => item.store_code === storeCode && (item.opened_business_date === businessDate || item.latest_business_date === businessDate));
  const caseIds = new Set(scopedCases.map((item) => item.id));
  const removed = {
    events: (value.materialEvents || []).filter((item) => item.store_code === storeCode && item.business_date === businessDate).length,
    plans: scopedPlans.length,
    documents: (value.documents || []).filter((item) => item.store_code === storeCode).length,
    purchase_orders: (value.purchaseOrders || []).filter((item) => item.store_code === storeCode && item.business_date === businessDate).length,
    receipt_orders: (value.receiptOrders || []).filter((item) => item.store_code === storeCode && item.business_date === businessDate).length,
    anomalies: (value.materialAnomalies || []).filter((item) => item.store_code === storeCode && item.business_date === businessDate).length,
    diagnosis_cases: scopedCases.length
  };
  value.materialEvents = (value.materialEvents || []).filter((item) => !(item.store_code === storeCode && item.business_date === businessDate));
  value.countPlans = (value.countPlans || []).filter((item) => !(item.store_code === storeCode && item.business_date === businessDate));
  // STORE001 被明确作为“干净门店”重建：历史演示盘点凭证没有可靠的
  // 营业日字段，若保留会在溯源界面制造假历史，因此一并移除该门店凭证。
  value.documents = (value.documents || []).filter((item) => item.store_code !== storeCode);
  value.purchaseOrders = (value.purchaseOrders || []).filter((item) => !(item.store_code === storeCode && item.business_date === businessDate));
  value.receiptOrders = (value.receiptOrders || []).filter((item) => !(item.store_code === storeCode && item.business_date === businessDate));
  value.materialAnomalies = (value.materialAnomalies || []).filter((item) => !(item.store_code === storeCode && item.business_date === businessDate));
  value.diagnosisCases = (value.diagnosisCases || []).filter((item) => !caseIds.has(item.id));
  value.operationTasks = (value.operationTasks || []).filter((item) => !caseIds.has(item.source_case_id));
  value.governanceTasks = (value.governanceTasks || []).filter((item) => !caseIds.has(item.source_case_id));
  value.ledgerSnapshots = (value.ledgerSnapshots || []).filter((item) => !(item.store_code === storeCode && item.business_date === businessDate));
  value.countPlanGateResults = (value.countPlanGateResults || []).filter((item) => !(item.store_code === storeCode && item.business_date === businessDate));
  value.demoDaySessions = (value.demoDaySessions || []).filter((item) => !(item.store_code === storeCode && item.business_date === businessDate));
  if (value.task?.store_code === storeCode && String(value.task.created_at || '').slice(0, 10) === businessDate) value.task = null;
  r2Audit(value, '总部演示控制台', '清理门店营业日演示状态', `${storeCode} · ${businessDate} · 仅清理演示库存动作、订货/收货、盘点、异常与研判工单；飞书原始导入和历史知识保留。`, `${storeCode}-${businessDate}`);
  return json({ store_code: storeCode, business_date: businessDate, removed, state: await r2SaveDemoState(env, value, 'store-business-day-reset') });
}

async function r2InitializeStoreBusinessDay(env, body = {}) {
  const value = await r2DemoState(env);
  const storeCode = String(body.store_code || STORE_CODE).trim().slice(0, 64);
  const businessDate = String(body.business_date || chinaBusinessDate()).slice(0, 10);
  if (!storeCode || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) return bad('请提供有效的门店和营业日。');
  const materials = r2LocalMaterialMaster(value.materialCatalog);
  if (!materials.length) return bad('系统物料主档为空，无法建立期初。', 409);
  const opening = {};
  for (const material of materials) opening[`${normalizedKey(material.material_name)}|${material.unit}`] = demoOpeningQty(material.material_name, material.unit);
  const initializedAt = now();
  const session = {
    id: id('DAY'), session_no: `DAY-${businessDate.replaceAll('-', '')}-${storeCode}`,
    store_code: storeCode, business_date: businessDate, status: 'active',
    opening_source: 'system_initialized_valid_baseline', opening_by_key: opening,
    opening_material_count: materials.length, opening_initialized_at: initializedAt,
    source_batch_id: null, source_imported_at: null, sales_record_count: 0, locked_at: null, locked_import: null
  };
  value.demoDaySessions = [...(value.demoDaySessions || []).filter((item) => !(item.store_code === storeCode && item.business_date === businessDate)), session];
  r2Audit(value, '总部演示控制台', '建立系统有效期初', `${session.session_no} · ${materials.length} 项全物料均写入系统有效期初；未读取飞书库存、收货或调拨。`, session.id);
  return json({ session: { ...session, locked_import: undefined }, state: await r2SaveDemoState(env, value, 'store-business-day-initialize') }, 201);
}

async function r2StorageHealth(env) {
  let d1 = { bound: Boolean(env.DB), reachable: false, table_count: null, legacy_tables_present: false, error: null };
  if (env.DB) {
    try {
      const tableCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").first();
      const legacyTables = await env.DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('feishu_sales_records', 'derived_inventory_ledger_daily', 'tasks', 'documents')").first();
      d1 = { ...d1, reachable: true, table_count: Number(tableCount?.count || 0), legacy_tables_present: Number(legacyTables?.count || 0) > 0 };
    } catch (error) {
      d1.error = error instanceof Error ? error.message : String(error);
    }
  }
  let r2 = { bound: Boolean(env.DEMO_STATE), reachable: false, current_state_present: false, size: null, error: null };
  if (env.DEMO_STATE) {
    try {
      const object = await env.DEMO_STATE.head(R2_DEMO_CURRENT_KEY);
      r2 = { ...r2, reachable: true, current_state_present: Boolean(object), size: object?.size ?? null };
    } catch (error) {
      r2.error = error instanceof Error ? error.message : String(error);
    }
  }
  return json({ active_provider: env.DEMO_STATE ? 'R2' : 'D1', d1_role: env.DEMO_STATE ? 'legacy_relational_store_preserved' : 'active', r2_role: env.DEMO_STATE ? 'active_demo_workflow_store' : 'not_bound', d1, r2, checked_at: now() });
}

async function r2ActionResult(response, step) {
  const payload = await response.json();
  if (!response.ok) throw new Error(`${step}失败：${payload?.error || response.status}`);
  return payload;
}

function r2DemoEventQty(unit, kind, index = 0) {
  if (unit === '个') return kind === 'receipt' ? 40 + index * 10 : 2 + index;
  if (unit === 'L') return kind === 'receipt' ? 12 + index * 3 : r2Round(0.4 + index * 0.2);
  return kind === 'receipt' ? 4 + index * 2 : r2Round(0.3 + index * 0.2);
}

// 一键演示编排严格限定在用户明确确认的单门店、单营业日范围内。
// 飞书原始快照、其他门店、历史营业日和研判知识不在清理范围。
async function r2RunStoreDayDemo(env, body = {}) {
  const storeCode = String(body.store_code || '').trim();
  const businessDate = String(body.business_date || '').trim();
  const expectedConfirmation = `REBUILD:${storeCode}:${businessDate}`;
  if (storeCode !== STORE_CODE || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate) || body.confirm !== expectedConfirmation) {
    return bad(`演示重建需要确认口令 ${expectedConfirmation}，且当前仅允许 ${STORE_CODE}。`, 409);
  }
  const steps = [];
  try {
    const reset = await r2ActionResult(await r2ResetStoreBusinessDay(env, { store_code: storeCode, business_date: businessDate }), '清理营业日');
    steps.push({ code: 'reset', label: '清理本营业日旧演示状态', result: reset.removed });

    const initialized = await r2ActionResult(await r2InitializeStoreBusinessDay(env, { store_code: storeCode, business_date: businessDate }), '初始化营业日');
    steps.push({ code: 'opening', label: '建立系统有效期初（全物料）', session_no: initialized.session.session_no, material_count: initialized.session.opening_material_count, source: 'system_initialized_valid_baseline' });

    const imported = await r2ImportFeishuSales(env, false, true);
    if (imported.feishuImport?.latest_business_date !== businessDate) throw new Error(`飞书最新营业日为 ${imported.feishuImport?.latest_business_date || '未知'}，不是 ${businessDate}`);
    const lockedSales = (imported.feishuImport.sales || []).filter((row) => row.store_code === storeCode && row.business_date === businessDate);
    if (!lockedSales.length) throw new Error(`${storeCode} 在 ${businessDate} 没有真实销售，已停止演示编排。`);
    steps.push({ code: 'sales', label: '同步飞书真实销售', batch_id: imported.feishuImport.id, record_count: lockedSales.length, sales_qty: r2Round(lockedSales.reduce((sum, row) => sum + Number(row.sales_qty || 0), 0)) });

    let value = await r2DemoState(env);
    let view = r2ImportedFeishuState(value).storeViews.find((item) => item.store_code === storeCode);
    const positiveRows = (view?.ledger || []).filter((row) => Number(row.theoretical_closing_qty) > 0 && row.unit && !/未配置/.test(row.unit));
    if (positiveRows.length < 4) throw new Error('全物料台账中不足 4 项有效物料，无法建立两笔收货与两笔报损。');
    const preferred = (pattern, excluded = new Set()) => positiveRows.find((row) => pattern.test(row.material_name) && !excluded.has(`${normalizedKey(row.material_name)}|${row.unit}`));
    const chosen = [], used = new Set();
    for (const pattern of [/牛奶|鲜奶/, /果糖|糖浆|黑糖成品/, /黑糖珍珠|珍珠/, /茶叶|冰块|半成品/]) {
      const row = preferred(pattern, used);
      if (row) { chosen.push(row); used.add(`${normalizedKey(row.material_name)}|${row.unit}`); }
    }
    for (const row of positiveRows) {
      if (chosen.length >= 4) break;
      const key = `${normalizedKey(row.material_name)}|${row.unit}`;
      if (!used.has(key)) { chosen.push(row); used.add(key); }
    }
    const receiptRows = chosen.slice(0, 2), scrapRows = chosen.slice(2, 4);
    const createdEvents = [];
    for (let index = 0; index < receiptRows.length; index += 1) {
      const row = receiptRows[index], qty = r2DemoEventQty(row.unit, 'receipt', index);
      const result = await r2ActionResult(await r2CreateMaterialEvent(env, { store_code: storeCode, business_date: businessDate, material_name: row.material_name, unit: row.unit, type: 'receipt', qty, reference: `正式演示收货 ${index + 1}` }), '写入收货');
      const event = result.materialEvents?.find((item) => item.store_code === storeCode && item.business_date === businessDate && item.type === 'receipt' && item.material_name === row.material_name);
      createdEvents.push(event || { type: 'receipt', material_name: row.material_name, unit: row.unit, qty });
    }
    for (let index = 0; index < scrapRows.length; index += 1) {
      const row = scrapRows[index], qty = r2DemoEventQty(row.unit, 'scrap', index);
      const result = await r2ActionResult(await r2CreateMaterialEvent(env, { store_code: storeCode, business_date: businessDate, material_name: row.material_name, unit: row.unit, type: 'scrap', qty, reference: index ? '操作损耗演示' : '过期报损演示' }), '写入报损');
      const event = result.materialEvents?.find((item) => item.store_code === storeCode && item.business_date === businessDate && item.type === 'scrap' && item.material_name === row.material_name);
      createdEvents.push(event || { type: 'scrap', material_name: row.material_name, unit: row.unit, qty });
    }
    steps.push({ code: 'events', label: '写入两笔收货与两笔报损', events: createdEvents.map((event) => ({ document_no: event.document_no || null, type: event.type, material_name: event.material_name, qty: event.qty, unit: event.unit })) });

    await r2ActionResult(await r2GenerateDailyCountPlans(env), '生成盘点计划');
    value = await r2DemoState(env);
    const fullPlan = (value.countPlans || []).find((plan) => plan.store_code === storeCode && plan.business_date === businessDate && plan.plan_type === 'daily_full' && plan.status === 'pending_store_count');
    if (!fullPlan) {
      const gate = (value.countPlanGateResults || []).find((item) => item.store_code === storeCode && item.business_date === businessDate);
      throw new Error(gate?.message || '未生成全物料盘点计划。');
    }
    steps.push({ code: 'plan', label: '刷新并生成每日盘点物料清单', plan_no: fullPlan.plan_no, material_count: fullPlan.material_count, snapshot_revision: fullPlan.snapshot_revision, snapshot_event_count: fullPlan.snapshot_event_count, bom_gate: fullPlan.bom_gate?.message });

    const countCandidates = fullPlan.lines.filter((line) => receiptRows.some((row) => normalizedKey(row.material_name) === normalizedKey(line.material_name) && row.unit === line.unit) && Number(line.theoretical_qty) > 0);
    if (countCandidates.length < 2) throw new Error('找不到两项已收货且理论库存为正的盘点物料。');
    const lossLine = countCandidates[0], entryLine = countCandidates[1];
    const lossThreshold = r2VarianceThreshold({ material_name: lossLine.material_name, unit: lossLine.unit, theoretical_closing_qty: lossLine.theoretical_qty });
    const lossDelta = r2Round(Math.min(Number(lossLine.theoretical_qty) * 0.8, Math.max(lossThreshold * 2, lossLine.unit === '个' ? 5 : 0.5)));
    const firstActuals = Object.fromEntries(fullPlan.lines.map((line) => [`${line.material_name}|${line.unit}`, Number(line.theoretical_qty || 0)]));
    firstActuals[`${lossLine.material_name}|${lossLine.unit}`] = r2Round(Math.max(0, Number(lossLine.theoretical_qty) - lossDelta));
    firstActuals[`${entryLine.material_name}|${entryLine.unit}`] = r2Round(Number(entryLine.theoretical_qty) * 10);
    await r2ActionResult(await r2CreateInitialCount(env, { planNo: fullPlan.plan_no, filename: `正式演示每日物料盘点-${fullPlan.plan_no}`, actuals: firstActuals }), '提交每日盘点');

    value = await r2DemoState(env);
    const diagnosis = (value.diagnosisCases || []).find((item) => item.case_type === 'store_daily' && item.store_code === storeCode && item.latest_business_date === businessDate && item.status !== 'closed');
    if (!diagnosis) throw new Error('盘点差异未生成门店级研判工单。');
    steps.push({ code: 'diagnosis', label: '生成一张门店级研判工单', case_no: diagnosis.case_no, variance_count: diagnosis.last_count_result?.variances?.length || 0, differences: diagnosis.last_count_result?.variances || [] });

    await r2ActionResult(await r2DispatchRemainingDiagnosisCount(env, diagnosis.id), '下发差异复盘');
    value = await r2DemoState(env);
    const recheckPlan = (value.countPlans || []).find((plan) => plan.parent_case_id === diagnosis.id && plan.plan_type === 'targeted_material_set' && plan.status === 'pending_store_count');
    if (!recheckPlan) throw new Error('未生成剩余差异复盘单。');
    const secondActuals = Object.fromEntries(recheckPlan.lines.map((line) => [`${line.material_name}|${line.unit}`, Number(line.theoretical_qty || 0)]));
    secondActuals[`${lossLine.material_name}|${lossLine.unit}`] = firstActuals[`${lossLine.material_name}|${lossLine.unit}`];
    await r2ActionResult(await r2CreateInitialCount(env, { planNo: recheckPlan.plan_no, filename: `正式演示差异复盘-${recheckPlan.plan_no}`, actuals: secondActuals }), '提交差异复盘');

    value = await r2DemoState(env);
    const continuedCase = (value.diagnosisCases || []).find((item) => item.id === diagnosis.id);
    if (!continuedCase || continuedCase.case_no !== diagnosis.case_no || continuedCase.status !== 'needs_hq_action') throw new Error('复盘后原研判工单未按预期继续跟踪。');
    await r2ActionResult(await r2DispatchTargetedDiagnosisCount(env, diagnosis.id, { material_name: lossLine.material_name, unit: lossLine.unit }), '下发单物料定向复盘');
    value = await r2DemoState(env);
    const targetedPlan = (value.countPlans || []).find((plan) => plan.parent_case_id === diagnosis.id && plan.plan_type === 'targeted_material' && plan.status === 'pending_store_count');
    if (!targetedPlan) throw new Error('未生成单物料定向复盘单。');
    await r2ActionResult(await r2CreateInitialCount(env, { planNo: targetedPlan.plan_no, filename: `正式演示定向复盘-${targetedPlan.plan_no}`, actuals: { [`${lossLine.material_name}|${lossLine.unit}`]: firstActuals[`${lossLine.material_name}|${lossLine.unit}`] } }), '提交定向复盘');
    steps.push({ code: 'continued_case', label: '复盘仍有差异并继续原工单', case_no: diagnosis.case_no, recheck_plan_no: recheckPlan.plan_no, targeted_plan_no: targetedPlan.plan_no, remaining_material: lossLine.material_name });

    await r2ActionResult(await r2RunDiagnosisAutoReview(env, diagnosis.id), '运行研判向导');
    const closed = await r2ActionResult(await r2ForceCloseDiagnosisCase(env, diagnosis.id, { attribution_code: 'unrecorded_loss', reason: `${lossLine.material_name} 两次复盘均较理论少 ${lossDelta}${lossLine.unit}，已排除本次单位录入错误，确认属于未登记实际损耗。`, resolution_method: `总部确认真实损耗并要求门店补录报损；后续同类问题先核对收货、BOM 与单位，再对 ${lossLine.material_name} 定向复盘。`, actor: '总部运营 Demo' }), '强制归因结案');
    steps.push({ code: 'closure', label: '总部归因结案并沉淀知识', case_no: closed.case.case_no, knowledge_id: closed.knowledge.id, attribution: closed.knowledge.root_cause_label, resolution_method: closed.knowledge.resolution_method });

    const finalState = await r2DemoState(env);
    const finalView = r2ImportedFeishuState(finalState).storeViews.find((item) => item.store_code === storeCode);
    const labels = (finalView?.ledger || []).reduce((summary, row) => { const code = row.inventory_label?.code || 'NORMAL'; summary[code] = (summary[code] || 0) + 1; return summary; }, {});
    r2Audit(finalState, '总部演示控制台', '完成 STORE001 全日运营闭环演示', `${storeCode} · ${businessDate} · 真实销售、期初、4 笔库存动作、全盘、两轮复盘、持续工单与知识沉淀均已完成。`, diagnosis.id);
    await r2SaveDemoState(env, finalState, 'store-day-demo-completed');
    return json({ ok: true, store_code: storeCode, business_date: businessDate, storage: 'R2', steps, final: { source_batch_id: initialized.session.source_batch_id, case_no: closed.case.case_no, case_status: closed.case.status, closure_mode: closed.case.closure_mode, knowledge_id: closed.knowledge.id, inventory_labels: labels } }, 201);
  } catch (error) {
    return bad(`正式演示编排中止：${error instanceof Error ? error.message : String(error)}`, 409);
  }
}

async function r2CleanupLegacySyntheticAnomalies(env) {
  const value = await r2DemoState(env);
  const before = (value.materialAnomalies || []).length;
  value.materialAnomalies = (value.materialAnomalies || []).filter((item) => !String(item.evidence || '').includes('演示情境'));
  const removed = before - value.materialAnomalies.length;
  if (removed) r2Audit(value, '系统', '清理旧版人工研判情境', `已移除 ${removed} 条含“演示情境”标记的历史研判；保留飞书台账与真实回算产生的记录。`);
  return json({ removed, state: await r2SaveDemoState(env, value, 'cleanup-legacy-synthetic') });
}

async function notifyFeishu(env, notification) {
  if (!env.FEISHU_WEBHOOK_URL) return { delivered: false, reason: '飞书群机器人 Webhook 尚未配置。' };
  try {
    const timestamp = String(Math.floor(Date.now() / 1000)), encoder = new TextEncoder();
    let sign = null;
    if (env.FEISHU_SIGNING_SECRET) {
      const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(`${timestamp}\n${env.FEISHU_SIGNING_SECRET}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      sign = base64(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode('')));
    }
    const message = notification.text
      ? { msg_type: 'text', content: { text: notification.text } }
      : {
          msg_type: 'interactive',
          card: {
            config: { wide_screen_mode: true },
            header: { title: { tag: 'plain_text', content: notification.title }, template: notification.template || 'blue' },
            elements: [
              ...notification.fields.map((field) => ({
                tag: 'div',
                text: { tag: 'lark_md', content: `**${String(field.label || '').slice(0, 80)}**\n${String(field.value || '—').slice(0, 500)}` }
              })),
              { tag: 'note', elements: [{ tag: 'plain_text', content: `来源：加盟商库存运营闭环 MVP · ${notification.note || '请进入运营任务中心处理'} ` }] }
            ]
          }
        };
    const response = await fetch(env.FEISHU_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(sign ? { timestamp, sign } : {}), ...message })
    });
    if (!response.ok) {
      console.error('Feishu notification failed', response.status);
      return { delivered: false, reason: `飞书机器人返回 HTTP ${response.status}` };
    }
    return { delivered: true };
  } catch (error) {
    console.error('Feishu notification error', error instanceof Error ? error.message : String(error));
    return { delivered: false, reason: error instanceof Error ? error.message : '飞书机器人通知失败。' };
  }
}

async function r2SendFeishuAlertTest(env) {
  const value = await r2DemoState(env);
  const recent = (value.audits || []).find((item) => item.action === '发送机器人主动连通测试' && Date.now() - Date.parse(item.created_at) < 10 * 60 * 1000);
  if (recent) return bad('测试消息已在 10 分钟内发送，请避免重复打扰运营群。', 429);
  const result = await notifyFeishu(env, {
    text: '【门店运营机器人】主动连通测试\n机器人已成功连接至品牌运营群。此为测试消息，无需处理。'
  });
  r2Audit(value, '总部运营', '发送机器人主动连通测试', result.delivered ? '已向品牌运营群发送测试卡片。' : `发送失败：${result.reason}`, 'FEISHU-ALERT-TEST');
  const state = await r2SaveDemoState(env, value, result.delivered ? 'feishu-alert-test' : 'feishu-alert-test-failed');
  return json({ delivered: result.delivered, reason: result.reason || null, sent_at: now(), state }, result.delivered ? 200 : 409);
}

function r2NotificationStatus(value, env) {
  const deliveries = value.notificationDeliveries || [];
  return {
    webhook_configured: Boolean(env.FEISHU_WEBHOOK_URL),
    last_delivery: deliveries[0] || null,
    successful_deliveries: deliveries.filter((item) => item.delivered).length
  };
}

async function r2NotificationConfig(env) {
  const value = await r2DemoState(env);
  return json({ settings: normalizeNotificationSettings(value.notificationSettings), status: r2NotificationStatus(value, env) });
}

async function r2UpdateNotificationConfig(env, body) {
  const value = await r2DemoState(env);
  value.notificationSettings = normalizeNotificationSettings(body);
  r2Audit(value, '总部运营', '更新机器人推送配置', `实时提醒：${value.notificationSettings.realtime.enabled ? '开启' : '关闭'}；日报：${value.notificationSettings.daily_report.enabled ? `${value.notificationSettings.daily_report.send_time} 开启` : '关闭'}。`, 'FEISHU-NOTIFICATION-CONFIG');
  const state = await r2SaveDemoState(env, value, 'notification-config-update');
  return json({ settings: state.notificationSettings, status: r2NotificationStatus(state, env) });
}

function r2DailyReportNotification(value) {
  const calculated = value.feishuImport?.sales?.length ? r2ImportedFeishuState(value) : null;
  const settings = normalizeNotificationSettings(value.notificationSettings);
  const businessDate = calculated?.hqSummary?.business_date || chinaBusinessDate();
  const risks = (value.materialAnomalies || []).filter((item) => item.business_date === businessDate && !['closed', 'auto_closed'].includes(item.status));
  const transfers = (value.feishuImport?.transfer_source?.records || []).filter((item) => item.business_date === businessDate);
  const plans = (value.countPlans || []).filter((item) => item.business_date === businessDate && item.status !== 'closed');
  const fields = [];
  if (settings.daily_report.include.sales) fields.push({ label: '销售', value: `${calculated?.hqSummary?.store_count || 0} 家门店 · ${calculated?.hqSummary?.sales_qty || 0} 杯` });
  if (settings.daily_report.include.inventory_risks) fields.push({ label: '库存研判', value: `${risks.length} 条待处理${risks.length ? ` · 高风险 ${risks.filter((item) => item.severity === 'high').length} 条` : ''}` });
  if (settings.daily_report.include.transfers) fields.push({ label: '调拨单', value: `${transfers.length} 条飞书单据已同步` });
  if (settings.daily_report.include.count_plans) fields.push({ label: '每日盘点', value: `${plans.length} 张待执行 / 复核计划` });
  return { dedupe_key: `daily:${businessDate}`, title: `${settings.templates.daily_title} · ${businessDate}`, template: risks.some((item) => item.severity === 'high') ? 'orange' : 'blue', fields, note: settings.templates.footer };
}

function r2RealtimeNotifications(value) {
  const settings = normalizeNotificationSettings(value.notificationSettings);
  const candidates = (value.materialAnomalies || []).filter((item) => !['closed', 'auto_closed'].includes(item.status)).filter((item) => {
    if (item.rule_code === 'NEGATIVE_THEORETICAL') return settings.realtime.rules.negative_inventory;
    if (item.rule_code === 'BELOW_SAFETY_STOCK') return settings.realtime.rules.below_safety_stock;
    return settings.realtime.rules.transfer_exception;
  });
  return candidates.map((item) => ({
    dedupe_key: `realtime:${item.id}`,
    title: settings.templates.realtime_title,
    template: item.severity === 'high' ? 'red' : 'orange',
    fields: [
      { label: '门店 / 物料', value: `${item.store_code} · ${item.material_name}` },
      { label: '风险', value: item.rule_code === 'NEGATIVE_THEORETICAL' ? `理论库存 ${item.theoretical_closing_qty}${item.unit}，已为负数` : `理论库存 ${item.theoretical_closing_qty}${item.unit}，低于安全库存 ${item.safety_qty}${item.unit}` },
      { label: '研判任务', value: item.judgment_task_no || item.id }
    ],
    note: settings.templates.footer
  }));
}

async function r2DeliverNotification(env, value, notification, type) {
  const result = await notifyFeishu(env, notification);
  value.notificationDeliveries.unshift({ id: id('NTF'), type, dedupe_key: notification.dedupe_key || null, title: notification.title || '机器人消息', delivered: result.delivered, reason: result.reason || null, created_at: now() });
  value.notificationDeliveries = value.notificationDeliveries.slice(0, 100);
  r2Audit(value, '机器人', result.delivered ? '发送飞书运营提醒' : '飞书运营提醒发送失败', `${type} · ${notification.title || '测试消息'}${result.reason ? ` · ${result.reason}` : ''}`, 'FEISHU-NOTIFICATION');
  return result;
}

async function r2PreviewNotification(env, body) {
  const value = await r2DemoState(env);
  const kind = body.kind === 'daily' ? 'daily' : 'realtime';
  const notification = kind === 'daily' ? r2DailyReportNotification(value) : (r2RealtimeNotifications(value)[0] || { dedupe_key: 'preview:realtime', title: normalizeNotificationSettings(value.notificationSettings).templates.realtime_title, template: 'orange', fields: [{ label: '当前状态', value: '暂无触发中的库存异常；这是提醒版式预览。' }], note: normalizeNotificationSettings(value.notificationSettings).templates.footer });
  const result = await r2DeliverNotification(env, value, { ...notification, dedupe_key: `preview:${kind}:${Date.now()}` }, `manual_preview_${kind}`);
  const state = await r2SaveDemoState(env, value, `notification-preview-${kind}`);
  return json({ delivered: result.delivered, reason: result.reason || null, state }, result.delivered ? 200 : 409);
}

async function r2MaybeDispatchScheduledNotifications(env, value) {
  const settings = normalizeNotificationSettings(value.notificationSettings);
  if (!env.FEISHU_WEBHOOK_URL) return;
  const deliveredKeys = new Set((value.notificationDeliveries || []).filter((item) => item.delivered).map((item) => item.dedupe_key));
  if (settings.realtime.enabled) {
    for (const notification of r2RealtimeNotifications(value)) {
      const latest = (value.notificationDeliveries || []).find((item) => item.delivered && item.dedupe_key === notification.dedupe_key);
      const withinCooldown = latest && Date.now() - Date.parse(latest.created_at) < Number(settings.realtime.cooldown_minutes || 30) * 60_000;
      if (!withinCooldown) await r2DeliverNotification(env, value, notification, 'realtime');
    }
  }
  if (settings.daily_report.enabled) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const localTime = `${parts.find((part) => part.type === 'hour')?.value}:${parts.find((part) => part.type === 'minute')?.value}`;
    const report = r2DailyReportNotification(value);
    if (localTime === settings.daily_report.send_time && !deliveredKeys.has(report.dedupe_key)) await r2DeliverNotification(env, value, report, 'daily_report');
  }
}

async function state(db) {
  const task = await db.prepare(`SELECT * FROM inventory_tasks WHERE store_code = ? ORDER BY created_at DESC LIMIT 1`).bind(STORE_CODE).first();
  const operationTask = await db.prepare(`SELECT * FROM operation_tasks WHERE store_code = ? ORDER BY created_at DESC LIMIT 1`).bind(STORE_CODE).first();
  const operationTasks = await db.prepare(`SELECT * FROM operation_tasks WHERE store_code = ? ORDER BY created_at DESC`).bind(STORE_CODE).all();
  const governanceTasks = await db.prepare(`SELECT * FROM governance_tasks ORDER BY created_at DESC`).all();
  const anomalyClosures = await db.prepare(`SELECT * FROM anomaly_manual_closures ORDER BY closed_at DESC`).all();
  const materialAnomalies = await db.prepare(`SELECT * FROM material_inventory_anomalies ORDER BY CASE severity WHEN 'high' THEN 0 ELSE 1 END, updated_at DESC`).all();
  const docs = await db.prepare(`SELECT * FROM count_documents WHERE store_code = ? ORDER BY received_at DESC`).bind(STORE_CODE).all();
  const documents = await Promise.all(docs.results.map(async (document) => {
    const lines = await db.prepare(`SELECT material_name, material_code, theoretical_qty, actual_qty, unit, match_status, ocr_confidence FROM count_lines WHERE document_id = ? ORDER BY id`).bind(document.id).all();
    return { ...document, lines: lines.results };
  }));
  const audits = task
    ? await db.prepare(`SELECT actor_role, action, detail, created_at FROM task_audit_events WHERE task_id = ? ORDER BY id DESC`).bind(task.id).all()
    : { results: [] };
  return { storeCode: STORE_CODE, stockStandard: STOCK_STANDARD, task: task || null, operationTask: operationTask || null, operationTasks: operationTasks.results, governanceTasks: governanceTasks.results, anomalyClosures: anomalyClosures.results, materialAnomalies: materialAnomalies.results, documents, audits: audits.results };
}

async function insertDocument(db, stage, filename, lines, note, documentType = 'inventory_count', previewData = null) {
  const documentId = id('PD');
  const createdAt = now();
  const statements = [
    db.prepare(`INSERT INTO count_documents (id, store_code, stage, document_type, original_filename, ocr_status, ocr_confidence, note, received_at, preview_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(documentId, STORE_CODE, stage, documentType, filename, 'mock_ocr_completed', 0.96, note, createdAt, previewData)
  ];
  lines.forEach((line) => {
    const difference = Math.abs(line.actual - line.expected) / line.expected;
    statements.push(
      db.prepare(`INSERT INTO count_lines (document_id, material_name, material_code, theoretical_qty, actual_qty, unit, match_status, ocr_confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(documentId, line.material, line.materialCode, line.expected, line.actual, line.unit, difference > 0.2 ? 'variance' : 'matched', 0.96)
    );
  });
  await db.batch(statements);
  return { documentId, createdAt };
}

async function createSupportingDocument(db, body) {
  const type = body.documentType === 'receipt' ? 'receipt' : 'scrap';
  const copy = type === 'receipt'
    ? { filename: '收货单.jpg', note: '演示 OCR：已识别入库单号、收货日期与 3 项物料' }
    : { filename: '报废单.jpg', note: '演示 OCR：已识别报废原因、报废日期与 2 项物料' };
  await insertDocument(db, 'initial', body.filename || copy.filename, [], copy.note, type, validPreviewData(body.previewData));
  return json(await state(db), 201);
}

async function createInitialCount(db, body, env) {
  const existing = await db.prepare(`SELECT id FROM inventory_tasks WHERE store_code = ? AND status != 'closed' LIMIT 1`).bind(STORE_CODE).first();
  if (existing) return bad('当前已有未闭环的盘点任务，请先完成复盘。', 409);

  const lines = [
    { ...STOCK_STANDARD[0], actual: 8.0 },
    { ...STOCK_STANDARD[1], actual: 40.8 },
    { ...STOCK_STANDARD[2], actual: 1305 }
  ];
  const document = await insertDocument(db, 'initial', body.filename || '门店盘点单.jpg', lines, '演示 OCR：已识别 3 个物料', 'inventory_count', validPreviewData(body.previewData));
  const milk = lines[0];
  const difference = milk.actual - milk.expected;
  const taskId = id('TASK');
  const diagnosis = `理论库存 ${milk.expected}${milk.unit}，首次盘点 ${milk.actual}${milk.unit}，差异 ${Math.abs(difference).toFixed(1)}${milk.unit}（${Math.round(Math.abs(difference) / milk.expected * 100)}%）。门店首次盘点已完成，等待总部判断是否需要复盘。`;
  await db.batch([
    db.prepare(`INSERT INTO inventory_tasks (id, store_code, document_id, material_name, theoretical_qty, initial_qty, unit, severity, status, diagnosis, assigned_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(taskId, STORE_CODE, document.documentId, milk.material, milk.expected, milk.actual, milk.unit, 'high', 'pending_hq_decision', diagnosis, '总部运营', document.createdAt),
    db.prepare(`INSERT INTO task_audit_events (task_id, actor_role, action, detail, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(taskId, '门店', '提交首次盘点单', `已提交 ${body.filename || '门店盘点单.jpg'}；演示 OCR 识别 3 个物料。`, document.createdAt),
    db.prepare(`INSERT INTO task_audit_events (task_id, actor_role, action, detail, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(taskId, '规则引擎', '生成盘点异常', '牛奶盘点差异超过 20%，已生成异常，等待总部决定是否要求门店单独复盘。', document.createdAt)
  ]);
  await notifyFeishu(env, { text: `【盘点异常待处理】${STORE_CODE} 的${milk.material}理论库存 ${milk.expected}${milk.unit}，首次盘点 ${milk.actual}${milk.unit}，差异 ${Math.abs(difference).toFixed(1)}${milk.unit}（${Math.round(Math.abs(difference) / milk.expected * 100)}%）。\n请进入运营任务中心处理：${DASHBOARD_URL}&task=${taskId}` });
  return json(await state(db), 201);
}

async function submitRecheck(db, body, env) {
  const task = await db.prepare(`SELECT * FROM inventory_tasks WHERE store_code = ? AND status = 'pending_store_recount' ORDER BY created_at DESC LIMIT 1`).bind(STORE_CODE).first();
  if (!task) return bad('没有等待门店复盘的任务。', 409);
  const lines = [{ ...STOCK_STANDARD[0], actual: 29.1 }];
  const document = await insertDocument(db, 'recheck', body.filename || '牛奶复盘单.jpg', lines, '演示 OCR：已识别牛奶复盘数量', 'inventory_count', validPreviewData(body.previewData));
  const detail = `复盘数量 ${lines[0].actual}${lines[0].unit}，与理论库存差异 ${Math.abs(lines[0].actual - lines[0].expected).toFixed(1)}${lines[0].unit}；首次盘点疑似少录数字，待总部确认。`;
  await db.batch([
    db.prepare(`UPDATE inventory_tasks SET recheck_qty = ?, status = ?, diagnosis = ? WHERE id = ?`)
      .bind(lines[0].actual, 'pending_hq_review', detail, task.id),
    db.prepare(`INSERT INTO task_audit_events (task_id, actor_role, action, detail, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(task.id, '门店', '提交复盘凭证', `已提交 ${body.filename || '牛奶复盘单.jpg'}；演示 OCR 识别牛奶 ${lines[0].actual}${lines[0].unit}。`, document.createdAt),
    db.prepare(`INSERT INTO task_audit_events (task_id, actor_role, action, detail, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(task.id, '规则引擎', '转总部复核', detail, document.createdAt)
  ]);
  await notifyFeishu(env, { text: `【复盘结果待验收】${STORE_CODE} 已提交${task.material_name}复盘：理论 ${task.theoretical_qty}${task.unit}，复盘 ${lines[0].actual}${lines[0].unit}；凭证：${body.filename || '牛奶复盘单.jpg'}。\n请进入运营任务中心验收：${DASHBOARD_URL}&task=${task.id}` });
  return json(await state(db));
}

async function requestRecount(db, taskId, env) {
  const task = await db.prepare(`SELECT * FROM inventory_tasks WHERE id = ?`).bind(taskId).first();
  if (!task) return bad('任务不存在。', 404);
  if (task.status !== 'pending_hq_decision') return bad('该异常当前不能要求复盘。', 409);
  const createdAt = now();
  const detail = `总部要求门店单独复盘${task.material_name}：理论 ${task.theoretical_qty}${task.unit}，首次盘点 ${task.initial_qty}${task.unit}，请核对是否录入错误或真实短缺。`;
  await db.batch([
    db.prepare(`UPDATE inventory_tasks SET status = ?, assigned_to = ?, diagnosis = ? WHERE id = ?`).bind('pending_store_recount', 'STORE001 店长', detail, task.id),
    db.prepare(`INSERT INTO task_audit_events (task_id, actor_role, action, detail, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(task.id, '总部运营', '要求门店复盘', detail, createdAt)
  ]);
  return json(await state(db));
}

async function endAudit(db, taskId, env) {
  const task = await db.prepare(`SELECT * FROM inventory_tasks WHERE id = ?`).bind(taskId).first();
  if (!task) return bad('任务不存在。', 404);
  if (task.status !== 'pending_hq_decision') return bad('该异常当前不能结束审核。', 409);
  const closedAt = now();
  const resolution = '总部结束审核：本次不要求门店复盘，保留首次盘点和异常审计记录。';
  await db.batch([
    db.prepare(`UPDATE inventory_tasks SET status = ?, closed_at = ?, resolution = ? WHERE id = ?`).bind('closed', closedAt, resolution, task.id),
    db.prepare(`INSERT INTO task_audit_events (task_id, actor_role, action, detail, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(task.id, '总部运营', '结束审核', resolution, closedAt)
  ]);
  return json(await state(db));
}

async function closeTask(db, taskId, env) {
  const task = await db.prepare(`SELECT * FROM inventory_tasks WHERE id = ?`).bind(taskId).first();
  if (!task) return bad('任务不存在。', 404);
  if (task.status !== 'pending_hq_review') return bad('该任务尚未收到门店复盘，暂不能关闭。', 409);
  const closedAt = now();
  const resolution = '总部已复核：复盘数量接近理论库存，首次盘点疑似录入错误；不调整库存台账，保留审计记录。';
  await db.batch([
    db.prepare(`UPDATE inventory_tasks SET status = ?, closed_at = ?, resolution = ? WHERE id = ?`).bind('closed', closedAt, resolution, task.id),
    db.prepare(`INSERT INTO task_audit_events (task_id, actor_role, action, detail, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(task.id, '总部运营', '复核并关闭', resolution, closedAt)
  ]);
  return json(await state(db));
}

async function createOperationTask(db, body) {
  const active = await db.prepare(`SELECT id FROM operation_tasks WHERE store_code = ? AND status != 'closed' LIMIT 1`).bind(STORE_CODE).first();
  if (active) return bad('当前已有未闭环的主动运营任务。', 409);
  const title = String(body.title || '冷藏温度巡检').trim().slice(0, 40);
  const instruction = String(body.instruction || '请在开店前检查冷藏设备温度是否处于 0–4°C，拍摄温度计或设备面板作为凭证后提交。').trim().slice(0, 240);
  if (!title || !instruction) return bad('请填写任务名称和执行要求。');
  const createdAt = now();
  await db.prepare(`INSERT INTO operation_tasks (id, store_code, task_type, title, instruction, status, assigned_to, created_at, source_anomaly_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id('OPT'), STORE_CODE, String(body.taskType || 'custom').slice(0, 40), title, instruction, 'pending_store_submission', 'STORE001 店长', createdAt, body.sourceAnomalyId || null)
    .run();
  return json(await state(db), 201);
}

async function createGovernanceTask(db, body) {
  const sourceAnomalyId = String(body.sourceAnomalyId || '').slice(0, 80);
  const existing = sourceAnomalyId ? await db.prepare(`SELECT id FROM governance_tasks WHERE source_anomaly_id = ? AND status != 'closed' LIMIT 1`).bind(sourceAnomalyId).first() : null;
  if (existing) return bad('该异常已有进行中的总部治理工单。', 409);
  const title = String(body.title || 'SKU BOM 维护工单').trim().slice(0, 60);
  const instruction = String(body.instruction || '补齐 SKU BOM、单位和物料映射，并重新运行理论消耗校验。').trim().slice(0, 300);
  const owner = String(body.owner || '商品 / 数据治理').trim().slice(0, 60);
  if (!title || !instruction || !owner) return bad('请填写工单名称、执行要求和责任方。');
  await db.prepare(`INSERT INTO governance_tasks (id, source_anomaly_id, title, instruction, owner, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id('GOV'), sourceAnomalyId || null, title, instruction, owner, 'pending', now())
    .run();
  return json(await state(db), 201);
}

async function closeGovernanceTask(db, taskId) {
  const task = await db.prepare(`SELECT * FROM governance_tasks WHERE id = ?`).bind(taskId).first();
  if (!task) return bad('总部治理工单不存在。', 404);
  if (task.status !== 'pending') return bad('该总部治理工单已完成。', 409);
  const closedAt = now();
  await db.prepare(`UPDATE governance_tasks SET status = ?, closed_at = ?, resolution = ? WHERE id = ?`)
    .bind('closed', closedAt, '总部已完成主数据治理，并已安排重新校验受影响 SKU。', taskId).run();
  return json(await state(db));
}

async function submitOperationTask(db, taskId, body, env) {
  const task = await db.prepare(`SELECT * FROM operation_tasks WHERE id = ?`).bind(taskId).first();
  if (!task) return bad('主动运营任务不存在。', 404);
  if (task.status !== 'pending_store_submission') return bad('该任务当前不能重复提交。', 409);
  const submittedAt = now();
  const document = await insertDocument(db, 'initial', body.filename || '门店巡检凭证.jpg', [], '演示 OCR：已归档门店主动任务凭证，等待总部验收。', 'operation_proof', validPreviewData(body.previewData));
  await db.prepare(`UPDATE operation_tasks SET status = ?, proof_filename = ?, proof_document_id = ?, submitted_at = ? WHERE id = ?`)
    .bind('pending_hq_review', body.filename || '冷藏温度巡检照片.jpg', document.documentId, submittedAt, taskId)
    .run();
  return json(await state(db));
}

async function closeOperationTask(db, taskId, env) {
  const task = await db.prepare(`SELECT * FROM operation_tasks WHERE id = ?`).bind(taskId).first();
  if (!task) return bad('主动运营任务不存在。', 404);
  if (task.status !== 'pending_hq_review') return bad('该任务尚未收到门店凭证，暂不能关闭。', 409);
  const closedAt = now();
  const resolution = `总部已验收：${task.title}的门店凭证已提交，本次任务完成。`;
  await db.prepare(`UPDATE operation_tasks SET status = ?, closed_at = ?, resolution = ? WHERE id = ?`)
    .bind('closed', closedAt, resolution, taskId)
    .run();
  return json(await state(db));
}

async function closeAnomalyAsMisclassification(db, anomalyId, body) {
  if (!/^ANM-(?:ST|SKU)-\d{3}$/.test(anomalyId)) return bad('异常编号格式不正确。');
  const reason = String(body.reason || '总部研判后确认：该条异常为规则误判或已知口径差异，本次结束研判并保留审计记录。').trim().slice(0, 240);
  const closedAt = now();
  await db.prepare(`INSERT INTO anomaly_manual_closures (anomaly_id, closure_reason, closed_by, closed_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(anomaly_id) DO UPDATE SET closure_reason = excluded.closure_reason, closed_by = excluded.closed_by, closed_at = excluded.closed_at`)
    .bind(anomalyId, reason, '总部运营', closedAt).run();
  return json(await state(db));
}

async function resetDemo(db, env) {
  await db.batch([
    db.prepare('DELETE FROM task_audit_events'),
    db.prepare('DELETE FROM count_lines'),
    db.prepare('DELETE FROM inventory_tasks'),
    db.prepare('DELETE FROM operation_tasks'),
    db.prepare('DELETE FROM governance_tasks'),
    db.prepare('DELETE FROM anomaly_manual_closures'),
    db.prepare('DELETE FROM material_inventory_anomalies'),
    db.prepare('DELETE FROM count_documents'),
    db.prepare('DELETE FROM demo_opening_inventory_counts'),
    db.prepare(`UPDATE demo_sales_runs SET status = 'reverted', reverted_at = ? WHERE status = 'active'`).bind(now())
  ]);
  if (env?.FEISHU_APP_ID && env?.FEISHU_APP_SECRET) await syncFeishuSales(db, env);
  return json(await state(db));
}

function feishuText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return value.map((item) => feishuText(item?.text ?? item?.text_arr ?? item?.name ?? item)).filter(Boolean).join(', ');
  if (typeof value === 'object') return feishuText(value.text ?? value.text_arr ?? value.name);
  return '';
}

function feishuNumber(value) {
  const parsed = Number(feishuText(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function feishuDate(value) {
  const milliseconds = feishuNumber(value);
  if (milliseconds) return new Date(milliseconds).toISOString().slice(0, 10);
  const text = feishuText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizedKey(value) {
  return feishuText(value).toLowerCase().replace(/[\s\-_/，,、()（）]/g, '');
}

function namesFromCatalog(fields) {
  return [fields['商品名称'], fields['商品别名']]
    .flatMap((value) => feishuText(value).split(/[，,、/\n]/))
    .map((value) => value.trim())
    .filter(Boolean);
}

async function getFeishuTenantToken(env) {
  if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET) throw new Error('飞书应用凭证尚未配置。');
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET })
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== 0 || !payload.tenant_access_token) throw new Error(`飞书应用鉴权失败：${payload.msg || response.status}`);
  return payload.tenant_access_token;
}

const FEISHU_PROJECT_FILE_MANIFEST_KEY = 'knowledge/feishu-deliverables/manifest.json';

async function syncFeishuProjectDocument(env) {
  if (!env?.DEMO_STATE) throw new Error('R2 知识快照存储尚未配置。');
  const documentId = String(env.FEISHU_PROJECT_DOCUMENT_ID || '').trim();
  if (!documentId) throw new Error('飞书项目文档 ID 尚未配置。');
  const token = await getFeishuTenantToken(env);
  const baseUrl = `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}`;
  const headers = { Authorization: `Bearer ${token}` };
  const [metadataResponse, contentResponse] = await Promise.all([
    fetch(baseUrl, { headers }),
    fetch(`${baseUrl}/raw_content`, { headers })
  ]);
  const [metadataPayload, contentPayload] = await Promise.all([
    metadataResponse.json().catch(() => ({})),
    contentResponse.json().catch(() => ({}))
  ]);
  if (!metadataResponse.ok || metadataPayload.code !== 0) {
    throw new Error(`飞书项目文档信息读取失败：${metadataPayload.msg || metadataResponse.status}`);
  }
  if (!contentResponse.ok || contentPayload.code !== 0) {
    throw new Error(`飞书项目文档正文读取失败：${contentPayload.msg || contentResponse.status}`);
  }
  const snapshot = {
    source: 'feishu_docx_read_only',
    document_id: documentId,
    source_url: `https://my.feishu.cn/docx/${documentId}`,
    title: metadataPayload.data?.document?.title || '',
    revision_id: metadataPayload.data?.document?.revision_id ?? null,
    content: contentPayload.data?.content || '',
    fetched_at: now()
  };
  await env.DEMO_STATE.put(`knowledge/feishu-project/${documentId}.json`, JSON.stringify(snapshot), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: {
      source: snapshot.source,
      document_id: snapshot.document_id,
      revision_id: String(snapshot.revision_id ?? '')
    }
  });
  return snapshot;
}

function feishuDownloadFilename(headers, fallback) {
  const disposition = headers.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quoted = disposition.match(/filename="([^"]+)"/i)?.[1];
  const raw = encoded || quoted || fallback;
  try { return decodeURIComponent(raw).replace(/[\\/:*?"<>|]/g, '_').slice(0, 180); } catch { return fallback; }
}

async function syncFeishuProjectFiles(env) {
  if (!env?.DEMO_STATE) throw new Error('R2 交付物存储尚未配置。');
  const fileTokens = String(env.FEISHU_PROJECT_FILE_TOKENS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!fileTokens.length) throw new Error('飞书项目交付物 token 尚未配置。');
  const token = await getFeishuTenantToken(env);
  const entries = [];
  for (const fileToken of fileTokens) {
    const response = await fetch(`https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      entries.push({ file_token: fileToken, status: 'failed', http_status: response.status, code: failure.code ?? null, message: failure.msg || '飞书云盘文件下载失败' });
      continue;
    }
    const filename = feishuDownloadFilename(response.headers, `${fileToken}.bin`);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const body = await response.arrayBuffer();
    const objectKey = `knowledge/feishu-deliverables/${fileToken}/${filename}`;
    await env.DEMO_STATE.put(objectKey, body, { httpMetadata: { contentType } });
    entries.push({ file_token: fileToken, status: 'synced', filename, content_type: contentType, size: body.byteLength, object_key: objectKey });
  }
  const manifest = { source: 'feishu_drive_read_only', fetched_at: now(), entries };
  await env.DEMO_STATE.put(FEISHU_PROJECT_FILE_MANIFEST_KEY, JSON.stringify(manifest), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' }
  });
  return manifest;
}

async function listFeishuRecords(token, tableId) {
  const items = [];
  let pageToken = null;
  do {
    const url = new URL(`https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_BASE_TOKEN}/tables/${tableId}/records`);
    url.searchParams.set('page_size', '500');
    if (pageToken) url.searchParams.set('page_token', pageToken);
    let response;
    let payload;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      payload = await response.json();
      if (response.ok && payload.code === 0) break;
      const retryable = String(payload.msg || '').includes('Data not ready');
      if (!retryable || attempt === 2) throw new Error(`读取飞书数据失败：${payload.msg || response.status}`);
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
    items.push(...(payload.data?.items || []));
    pageToken = payload.data?.has_more ? payload.data?.page_token : null;
  } while (pageToken);
  return items;
}

function feishuField(fields, names) {
  for (const name of names) {
    if (Object.hasOwn(fields || {}, name) && feishuText(fields[name])) return feishuText(fields[name]);
  }
  return '';
}

function feishuMaterialInfo(fields, materialCatalog, names = ['物料名称', '调拨物料', '物料', '商品名称']) {
  const raw = names.map((name) => fields?.[name]).find((value) => value != null);
  const linked = feishuRecordReferences(raw).map((reference) => materialCatalog?.byRecordId?.get(reference)).find(Boolean);
  const materialName = linked?.name || feishuField(fields, names);
  const unit = feishuField(fields, ['单位', '计量单位']) || linked?.unit || materialCatalog?.byName?.get(materialName) || '未配置单位';
  return { materialName, unit };
}

function feishuTransferRecord(record, materialCatalog) {
  const fields = record.fields || {};
  const sourceParty = feishuField(fields, ['调出方', '调出门店', '出库门店', '调拨发出方', '来源门店', '调出仓']);
  const targetParty = feishuField(fields, ['调入方', '调入门店', '入库门店', '调拨接收方', '目标门店', '调入仓']);
  const { materialName, unit } = feishuMaterialInfo(fields, materialCatalog);
  const quantity = feishuNumber(fields['调拨数量']) ?? feishuNumber(fields['数量']) ?? feishuNumber(fields['调拨量']) ?? feishuNumber(fields['数量(单位)']);
  const businessDate = feishuDate(fields['调拨日期']) || feishuDate(fields['日期']) || feishuDate(fields['出库日期']) || feishuDate(fields['创建日期']) || feishuDate(fields['创建时间']);
  const documentNo = feishuField(fields, ['调拨单号', '单据编号', '调拨编号', '单号']) || `FS-TR-${record.record_id}`;
  return {
    record_id: record.record_id, document_no: documentNo, business_date: businessDate,
    from_party: sourceParty, to_party: targetParty, material_name: materialName, unit,
    qty: quantity == null ? null : r2Round(quantity), status: feishuField(fields, ['状态', '调拨状态', '审批状态']) || '待处理', raw_field_names: Object.keys(fields)
  };
}

function feishuRecordReferences(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => feishuRecordReferences(item));
  if (typeof value === 'object') return Object.values(value).flatMap((item) => feishuRecordReferences(item));
  return [String(value)];
}

function feishuTransferDetailRecord(record, materialCatalog) {
  const fields = record.fields || {};
  const linkFieldNames = ['关联主单', '关联调拨单', '调拨单关联', '调拨单', '关联单据', '单据号'];
  const references = linkFieldNames.flatMap((name) => feishuRecordReferences(fields[name]));
  const { materialName, unit } = feishuMaterialInfo(fields, materialCatalog);
  const quantity = feishuNumber(fields['调拨数量']) ?? feishuNumber(fields['数量']) ?? feishuNumber(fields['调拨量']) ?? feishuNumber(fields['数量(单位)']);
  return {
    record_id: record.record_id, references, material_name: materialName, unit,
    qty: quantity == null ? null : r2Round(quantity),
    to_party: feishuField(fields, ['调入方', '调入门店', '入库门店', '收货门店', '目标门店', '加盟店', '门店']),
    business_date: feishuDate(fields['调拨日期']) || feishuDate(fields['日期']) || feishuDate(fields['创建日期']),
    raw_field_names: Object.keys(fields)
  };
}

function transferReferenceMatches(detail, header) {
  const candidates = [header.record_id, header.document_no].filter(Boolean).map((item) => normalizedKey(item));
  return detail.references.some((reference) => candidates.includes(normalizedKey(reference)));
}

function transferFieldDiagnostics(records) {
  const names = new Set(records.flatMap((record) => Object.keys(record.fields || {})));
  const exists = (aliases) => aliases.some((name) => names.has(name));
  const required = [
    ['调入方', ['调入方', '调入门店', '入库门店', '调拨接收方', '目标门店', '调入仓']],
    ['物料', ['物料名称', '调拨物料', '物料', '商品名称']],
    ['数量', ['调拨数量', '数量', '调拨量', '数量(单位)']],
    ['单位', ['单位', '计量单位']]
  ];
  return { detected_fields: Array.from(names), missing_required_fields: required.filter(([, aliases]) => !exists(aliases)).map(([label]) => label) };
}

async function runInChunks(db, statements, size = 80) {
  for (let index = 0; index < statements.length; index += size) await db.batch(statements.slice(index, index + size));
}

async function hasD1Table(db, tableName) {
  const row = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).bind(tableName).first();
  return Boolean(row?.name);
}

async function activeDemoSales(db) {
  return db.prepare(`SELECT r.id, r.store_code, r.business_date, r.sku_code, r.product_name, r.sales_qty, r.sales_amount FROM demo_sales_records r JOIN demo_sales_runs run ON run.id = r.run_id WHERE run.status = 'active' ORDER BY r.created_at ASC`).all();
}

const DEMO_OPENING_QTY = Object.freeze({
  '冰块': 25, '半成品奶茶': 18, '双杯袋': 300, '吸管': 300, '塑料杯': 300,
  '果糖': 6, '黑糖冻': 8, '黑糖成品': 8, '黑糖珍珠': 12,
  '杯子': 300, '牛奶': 120, '糖浆': 50, '茶叶': 3
});

function previousBusinessDate(businessDate) {
  const date = new Date(`${businessDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function demoOpeningQty(material, unit) {
  if (Object.hasOwn(DEMO_OPENING_QTY, material)) return DEMO_OPENING_QTY[material];
  if (unit === '个') return 200;
  if (unit === 'L') return 80;
  if (unit === 'kg') return 10;
  return 20;
}

// R2-only sales sandbox. It is deliberately small and explicit: SKU is the
// accounting dimension, while the ledger aggregates all SKU BOM lines by
// material. It allows the full demo to run while D1 writes are unavailable.
const R2_DEMO_BOM = Object.freeze({
  SKU011: [
    ['冰块', 'kg', 0.19], ['半成品奶茶', 'kg', 0.15], ['双杯袋', '个', 1], ['吸管', '个', 1], ['塑料杯', '个', 1],
    ['果糖', 'kg', 0.01], ['黑糖冻', 'kg', 0.02], ['黑糖成品', 'kg', 0.01], ['黑糖珍珠', 'kg', 0.02]
  ],
  SKU013: [
    ['冰块', 'kg', 0.12], ['半成品奶茶', 'kg', 0.24], ['双杯袋', '个', 1], ['吸管', '个', 1], ['塑料杯', '个', 1],
    ['果糖', 'kg', 0.02], ['黑糖冻', 'kg', 0.03], ['黑糖成品', 'kg', 0.01], ['黑糖珍珠', 'kg', 0.07]
  ],
  SKU014: [
    ['冰块', 'kg', 0.12], ['半成品奶茶', 'kg', 0.24], ['双杯袋', '个', 1], ['吸管', '个', 1], ['塑料杯', '个', 1],
    ['果糖', 'kg', 0.01], ['黑糖冻', 'kg', 0.03], ['黑糖成品', 'kg', 0.01], ['黑糖珍珠', 'kg', 0.07]
  ],
  SKU015: [
    ['冰块', 'kg', 0.23], ['半成品奶茶', 'kg', 0.27], ['双杯袋', '个', 1], ['吸管', '个', 1], ['塑料杯', '个', 1],
    ['果糖', 'kg', 0.025], ['黑糖冻', 'kg', 0.03], ['黑糖成品', 'kg', 0.01], ['黑糖珍珠', 'kg', 0.09]
  ],
  SKU016: [
    ['冰块', 'kg', 0.23], ['半成品奶茶', 'kg', 0.27], ['双杯袋', '个', 1], ['吸管', '个', 1], ['塑料杯', '个', 1],
    ['果糖', 'kg', 0.015], ['黑糖冻', 'kg', 0.03], ['黑糖成品', 'kg', 0.01], ['黑糖珍珠', 'kg', 0.09]
  ],
  SKU018: [
    ['冰块', 'kg', 0.19], ['半成品奶茶', 'kg', 0.15], ['双杯袋', '个', 1], ['吸管', '个', 1], ['塑料杯', '个', 1],
    ['果糖', 'kg', 0.02], ['黑糖冻', 'kg', 0.02], ['黑糖成品', 'kg', 0.01], ['黑糖珍珠', 'kg', 0.02]
  ],
  SKU003: [['杯子', '个', 1], ['牛奶', 'L', 0.2], ['糖浆', 'kg', 0.02], ['茶叶', 'kg', 0.004]]
});

// 这条正式演示链路的期初、物料主档和 BOM 由系统维护。飞书只读取销售
// 事实，避免旧台账、收货或调拨记录重新污染已初始化的门店营业日。
const R2_LOCAL_PRODUCT_CATALOG = Object.freeze(Object.fromEntries(R2_PRODUCT_MASTERS.map((item) => [item.sku_code, [item.product_name, item.product_alias, ...(item.aliases || [])].filter(Boolean)])));

function r2LocalMaterialMaster(materialCatalog = R2_MATERIAL_MASTERS) {
  return (materialCatalog || []).filter((item) => item.status !== 'inactive').map((item) => ({
    material_name: item.material_name, unit: item.base_unit, base_unit: item.base_unit,
    procurement_unit: item.procurement_unit, conversion_factor: Number(item.conversion_factor || 1),
    remark: item.remark || '', brand: item.brand || '', daily_count_enabled: item.daily_count_enabled !== false,
    count_policy: item.count_policy || (item.daily_count_enabled === false ? 'optional' : 'daily'),
    source: item.source || 'system_inventory_master'
  })).sort((left, right) => left.material_name.localeCompare(right.material_name, 'zh-CN'));
}

function r2DailyCountEnabled(value, materialName) {
  const master = (value.materialCatalog || []).find((item) => normalizedKey(item.material_name) === normalizedKey(materialName));
  if (master) return (master.count_policy || (master.daily_count_enabled === false ? 'optional' : 'daily')) === 'daily';
  return !R2_DAILY_COUNT_EXCLUDED_MATERIALS.some((name) => normalizedKey(name) === normalizedKey(materialName));
}

function r2ToBaseUnitFactor(fromUnit, master) {
  if (!master || fromUnit === master.base_unit) return 1;
  if (fromUnit === master.procurement_unit) return Number(master.conversion_factor || 1);
  if (fromUnit === 'kg' && master.base_unit === 'g') return 1000;
  if (fromUnit === 'g' && master.base_unit === 'kg') return 0.001;
  return null;
}

function r2LocalBomBySku(materialCatalog = R2_MATERIAL_MASTERS) {
  const masterByName = new Map((materialCatalog || []).map((item) => [normalizedKey(item.material_name), item]));
  return Object.fromEntries(Object.entries(R2_DEMO_BOM).map(([sku, lines]) => [sku, lines.map(([material_name, unit, usage_per_sale]) => {
    const master = masterByName.get(normalizedKey(material_name));
    const factor = r2ToBaseUnitFactor(unit, master) ?? 1;
    const isBrandReal = R2_REAL_PRODUCT_SKU_SET.has(sku);
    return { material_name, unit: master?.base_unit || unit, usage_per_sale: r2Round(Number(usage_per_sale) * factor), source: isBrandReal ? 'feishu_brand_bom_snapshot' : 'mvp_mock_bom', source_updated_at: isBrandReal ? '2026-09-14T01:20:30.838Z' : null, data_classification: isBrandReal ? 'brand_real' : 'mvp_mock' };
  })]));
}

function r2FeishuBrandBomBySku(bomRecords, materialRecords, materialCatalog, importedAt) {
  const materialUnits = new Map((materialRecords || []).map((record) => [feishuText(record.fields?.['物料名称']), feishuText(record.fields?.['单位'])]));
  const masterByName = new Map((materialCatalog || []).map((item) => [normalizedKey(item.material_name), item]));
  const result = {};
  const rejected = [];
  for (const record of bomRecords || []) {
    const fields = record.fields || {};
    const sku = feishuText(fields['SKU编码']);
    if (!R2_REAL_PRODUCT_SKU_SET.has(sku)) continue;
    const materialName = feishuText(fields['物料名称']);
    const rawUnit = feishuText(fields['单位']) || materialUnits.get(materialName) || '';
    const usage = feishuNumber(fields['用量']);
    const master = masterByName.get(normalizedKey(materialName));
    const factor = r2ToBaseUnitFactor(rawUnit, master);
    if (!materialName || !master || usage == null || usage <= 0 || factor == null) {
      rejected.push({ sku_code: sku, source_record_id: record.record_id || null, material_name: materialName || null, unit: rawUnit || null });
      continue;
    }
    const line = {
      material_name: materialName,
      unit: master.base_unit,
      usage_per_sale: r2Round(usage * factor),
      source: 'feishu_live_brand_bom',
      source_record_id: record.record_id || null,
      source_updated_at: importedAt,
      data_classification: 'brand_real',
      source_usage: usage,
      source_unit: rawUnit
    };
    result[sku] = [...(result[sku] || []), line];
  }
  const counts = Object.fromEntries(R2_REAL_PRODUCT_SKUS.map((sku) => [sku, (result[sku] || []).length]));
  const complete = R2_REAL_PRODUCT_SKUS.every((sku) => counts[sku] === 9) && rejected.length === 0;
  return { complete, bomBySku: result, counts, rejected };
}

function r2ResolveLocalSku(directSku, productName, productCatalog = R2_LOCAL_PRODUCT_CATALOG) {
  if (R2_DEMO_BOM[directSku]) return directSku;
  const target = normalizedKey(productName);
  for (const [sku, names] of Object.entries(productCatalog)) if (names.some((name) => normalizedKey(name) === target)) return sku;
  return directSku || '';
}

function r2ProductCatalogAliases(products = []) {
  return Object.fromEntries((products || []).map((item) => [item.sku_code, [item.product_name, item.product_alias, ...(item.aliases || [])].filter(Boolean)]));
}

function r2ProductName(products, skuCode) {
  return (products || []).find((item) => item.sku_code === skuCode)?.product_name || R2_LOCAL_PRODUCT_CATALOG[skuCode]?.[0] || '';
}

function r2SafetyStockPolicy(value, storeCode, materialName, unit) {
  return (value.safetyStockPolicies || []).find((item) => item.status !== 'inactive'
    && item.store_code === storeCode
    && normalizedKey(item.material_name) === normalizedKey(materialName)
    && item.unit === unit) || null;
}

function r2AlignSafetyStockPolicies(policies, materialCatalog) {
  let converted = 0;
  const masterByName = new Map((materialCatalog || []).map((item) => [normalizedKey(item.material_name), item]));
  const normalized = (policies || []).map((policy) => {
    const master = masterByName.get(normalizedKey(policy.material_name));
    const sourceQty = policy.source_qty ?? policy.safety_qty;
    const sourceUnit = policy.source_unit || policy.unit;
    const factor = r2ToBaseUnitFactor(sourceUnit, master);
    if (!master || factor == null) return policy;
    const normalizedQty = Math.round((Number(sourceQty || 0) * factor + Number.EPSILON) * 1000000) / 1000000;
    if (policy.unit === master.base_unit && policy.source_unit == null) return policy;
    converted += 1;
    return { ...policy, safety_qty: normalizedQty, unit: master.base_unit, source_qty: sourceQty, source_unit: sourceUnit, conversion_factor_applied: factor };
  });
  return { policies: normalized, converted };
}

function r2Round(value) { return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000; }

function r2MaterialKnowhowProfile(materialName, unit) {
  const name = String(materialName || '');
  let key = 'general_material';
  if (/冰块|冰沙冰/.test(name)) key = 'melt_loss_material';
  else if (/半成品|珍珠|茶汤|茶底|茶液|布丁|冻/.test(name)) key = 'prepared_component';
  else if (/杯|吸管|袋|盖|勺|包装/.test(name)) key = 'packaging_consumable';
  else if (/牛奶|鲜奶|奶油|乳/.test(name)) key = 'perishable_liquid';
  else if (/糖浆|果糖|黑糖|茶叶|粉|酱/.test(name)) key = 'measured_ingredient';
  const template = R2_INDUSTRY_MATERIAL_RULES[key];
  const absoluteTolerance = template.absolute_tolerance?.[unit] ?? (R2_NEGATIVE_TOLERANCE_BY_UNIT[unit] ?? 0.1);
  return { ...template, unit, absolute_tolerance_qty: absoluteTolerance, profile_source: '餐饮行业规则模板（Demo 建议值）', configuration_status: 'template_default', configuration_note: '容差和出成率需结合品牌 SOP、包装规格与门店实测后确认。' };
}

function r2VarianceThreshold(row) {
  const profile = row?.industry_profile || r2MaterialKnowhowProfile(row?.material_name, row?.unit);
  const scale = Math.abs(Number(row?.theoretical_closing_qty || 0));
  return r2Round(Math.max(Number(profile.absolute_tolerance_qty || 0), scale * Number(profile.count_tolerance_rate || 0.05)));
}

function r2IndustryAssessment(row) {
  const profile = row.industry_profile || r2MaterialKnowhowProfile(row.material_name, row.unit);
  const physicalQty = row.actual_inventory_qty == null ? null : Number(row.actual_inventory_qty);
  const physicalDelta = physicalQty == null ? null : r2Round(physicalQty - Number(row.theoretical_closing_qty || 0));
  const threshold = r2VarianceThreshold({ ...row, industry_profile: profile });
  const checks = [
    { code: 'prior_cycle', label: '上周期负库存', status: row.prior_closing_qty == null ? 'insufficient' : Number(row.prior_closing_qty) < 0 ? 'suspected' : 'excluded', finding: row.prior_closing_qty == null ? '未找到可比历史期末' : Number(row.prior_closing_qty) < 0 ? `上周期期末 ${row.prior_closing_qty}${row.unit} 已为负` : `上周期期末 ${row.prior_closing_qty}${row.unit}，未发现负数` },
    { code: 'receipt', label: '收货是否漏记', status: row.receipt_evidence_status === 'no_record' ? 'insufficient' : 'evidenced', finding: row.receipt_evidence_note || '未找到收货流水' },
    { code: 'opening_source', label: '系统期初', status: /待首日盘点|未配置/.test(row.baseline_source || '') ? 'suspected' : 'evidenced', finding: `${row.baseline_source || '来源未标注'} · ${row.opening_qty}${row.unit}` },
    { code: 'bom_coverage', label: 'BOM 配方', status: (row.sku_contributors || []).length ? 'evidenced' : 'suspected', finding: (row.sku_contributors || []).length ? `已由 ${(row.sku_contributors || []).length} 个销售 SKU 拆解` : '没有可追溯的销售 SKU BOM 明细' },
    { code: 'unit_conversion', label: '单位换算', status: 'insufficient', finding: `当前仅确认库存单位为 ${row.unit}；采购包装与盘点单位换算待品牌配置` },
    ...(profile.production_required ? [{ code: 'production_yield', label: '制作出成率', status: 'insufficient', finding: '该物料属于现制 / 自制类型，尚未接入制作批次与品牌标准出成率' }] : []),
    { code: 'physical_count', label: '门店实盘', status: physicalQty == null ? 'waiting' : Math.abs(physicalDelta) > threshold ? 'suspected' : 'excluded', finding: physicalQty == null ? '尚未录入实盘，盘点只作为排除后的兜底动作' : `实盘 ${physicalQty}${row.unit}，较理论 ${physicalDelta >= 0 ? '+' : ''}${physicalDelta}${row.unit}；行业模板阈值 ${threshold}${row.unit}` }
  ];
  let nextStep = { code: 'continue_monitoring', label: '继续观察', reason: '当前没有超出行业模板阈值的异常证据。', stage: 'monitor' };
  if (Number(row.opening_qty) < 0) {
    if (Number(row.prior_closing_qty) < 0) nextStep = { code: 'inspect_prior_cycle', label: '先查看上一周期台账', reason: '上周期已经出现负库存，当前问题更可能是跨期遗留。', stage: 'evidence_first' };
    else if (row.receipt_evidence_status === 'no_record') nextStep = { code: 'inspect_receipt', label: '先核对收货单与入账时间', reason: '收货证据不足，暂时不能判断门店是否漏收货。', stage: 'evidence_first' };
    else nextStep = { code: 'inspect_opening', label: '先核验系统期初与单位', reason: '前置流水暂未解释负期初，应核对期初来源和单位换算。', stage: 'evidence_first' };
  } else if (physicalQty != null && Math.abs(physicalDelta) > threshold) {
    if (!(row.sku_contributors || []).length) nextStep = { code: 'maintain_bom', label: '先维护 BOM / SKU 映射', reason: '缺少可追溯的 BOM 拆解，理论库存暂不具备完整判断基础。', stage: 'evidence_first' };
    else if (row.receipt_evidence_status === 'no_record') nextStep = { code: 'inspect_receipt', label: '先核对收货与调拨流水', reason: '实盘差异较大且收货证据不足，不能直接判定为盘点错误。', stage: 'evidence_first' };
    else if (profile.production_required) nextStep = { code: 'inspect_yield', label: '核验制作批次与出成率', reason: '现制物料需要先排除制作损耗和出成率偏差。', stage: 'evidence_first' };
    else nextStep = { code: 'targeted_count', label: '下发该物料定向复盘', reason: 'BOM 与收货证据已具备，盘点录入或实际损耗仍需门店复核。', stage: 'count_fallback' };
  }
  const insufficientCount = checks.filter((item) => item.status === 'insufficient').length;
  const confidence = checks.some((item) => item.status === 'suspected') ? (insufficientCount >= 2 ? 'medium' : 'high') : insufficientCount ? 'low' : 'high';
  return { profile, tolerance_qty: threshold, checks, next_step: nextStep, confidence, conclusion: `${profile.label}规则：${nextStep.label}。${nextStep.reason}` };
}

function r2DemoRows(businessDate) {
  return [
    { store_code: STORE_CODE, business_date: businessDate, sku_code: 'SKU011', product_name: 'Brown Sugar Boba Milk Tea 400 N', sales_qty: 12, sales_amount: 276 },
    { store_code: STORE_CODE, business_date: businessDate, sku_code: 'SKU013', product_name: 'Brown Sugar Boba Milk Tea 500 N', sales_qty: 10, sales_amount: 230 },
    { store_code: STORE_CODE, business_date: businessDate, sku_code: 'SKU003', product_name: '桃桃乌龙', sales_qty: 18, sales_amount: 414 }
  ];
}

function r2CalculateDemoLedger(demo) {
  const byMaterial = new Map();
  for (const sale of demo.rows || []) {
    for (const [material, unit, usage] of R2_DEMO_BOM[sale.sku_code] || []) {
      const key = `${normalizedKey(material)}|${unit}`;
      const entry = byMaterial.get(key) || { material_name: material, unit, opening_qty: demo.opening?.[key] ?? demoOpeningQty(material, unit), receipt_qty: 0, transfer_in_qty: 0, transfer_out_qty: 0, scrap_qty: 0, bom_consumption_qty: 0, source_sales_qty: 0, sku_contributors: [] };
      const consumption = r2Round(sale.sales_qty * usage);
      entry.bom_consumption_qty = r2Round(entry.bom_consumption_qty + consumption);
      entry.source_sales_qty = r2Round(entry.source_sales_qty + sale.sales_qty);
      entry.sku_contributors.push({ sku_code: sale.sku_code, product_name: sale.product_name, sales_qty: sale.sales_qty, usage_per_sale: usage, consumption_qty: consumption, unit });
      byMaterial.set(key, entry);
    }
  }
  return Array.from(byMaterial.values()).map((entry) => ({
    ...entry,
    theoretical_closing_qty: r2Round(entry.opening_qty + entry.receipt_qty + entry.transfer_in_qty - entry.transfer_out_qty - entry.scrap_qty - entry.bom_consumption_qty),
    source_closing_qty: null,
    reconciliation_delta: null
  })).sort((a, b) => a.material_name.localeCompare(b.material_name, 'zh-CN'));
}

// 实盘与理论库存是两条口径：实盘只取最近一次门店盘点凭证，不参与理论流水回算。
function r2AttachLatestPhysicalCounts(value, ledger, storeCode, businessDate = null) {
  const latestByMaterial = new Map();
  const documents = (value.documents || [])
    .filter((document) => document.store_code === storeCode && document.document_type === 'inventory_count' && (!businessDate || document.business_date === businessDate))
    .sort((left, right) => String(right.received_at || '').localeCompare(String(left.received_at || '')));
  for (const document of documents) {
    for (const line of document.lines || []) {
      if (!line.material_name || !line.unit) continue;
      const key = `${normalizedKey(line.material_name)}|${line.unit}`;
      if (!latestByMaterial.has(key) && Number.isFinite(Number(line.actual_qty))) {
        latestByMaterial.set(key, { qty: Number(line.actual_qty), counted_at: document.received_at, document_id: document.id });
      }
    }
  }
  return ledger.map((row) => {
    const physical = latestByMaterial.get(`${normalizedKey(row.material_name)}|${row.unit}`);
    const actualQty = physical ? r2Round(physical.qty) : null;
    const actualDelta = physical ? r2Round(physical.qty - Number(row.theoretical_closing_qty || 0)) : null;
    const threshold = r2VarianceThreshold(row);
    let inventoryLabel = { code: 'NORMAL', label: '正常', tone: 'normal', reason: '理论库存可回算，当前未发现超出规则阈值的问题。' };
    if (!row.unit || /未配置/.test(row.unit) || /待首日盘点/.test(row.baseline_source || '')) inventoryLabel = { code: 'DATA_INCOMPLETE', label: '数据不完整', tone: 'warning', reason: '库存单位或有效期初尚未完整配置。' };
    else if (Number(row.theoretical_closing_qty) < 0) inventoryLabel = { code: 'THEORETICAL_ABNORMAL', label: '理论异常', tone: 'danger', reason: `理论期末 ${row.theoretical_closing_qty}${row.unit} 已为负数。` };
    else if (actualDelta != null && Math.abs(actualDelta) > threshold) inventoryLabel = { code: 'COUNT_VARIANCE', label: '实盘差异', tone: 'danger', reason: `实盘较理论 ${actualDelta >= 0 ? '+' : ''}${actualDelta}${row.unit}，超过容差 ${threshold}${row.unit}。` };
    return {
      ...row,
      actual_inventory_qty: actualQty,
      actual_inventory_at: physical?.counted_at || null,
      actual_inventory_document_id: physical?.document_id || null,
      actual_vs_theoretical_qty: actualDelta,
      inventory_label: inventoryLabel
    };
  });
}

async function r2CreateDemoSales(env) {
  const value = await r2DemoState(env);
  const businessDate = chinaBusinessDate();
  const rows = r2DemoRows(businessDate);
  const opening = {};
  for (const lines of Object.values(R2_DEMO_BOM)) for (const [material, unit] of lines) opening[`${normalizedKey(material)}|${unit}`] = demoOpeningQty(material, unit);
  value.demoSales = { id: id('R2-SALE'), business_date: businessDate, counted_date: previousBusinessDate(businessDate), created_at: now(), rows, opening };
  const saved = await r2SaveDemoState(env, value, 'sales-generate');
  return json({ runId: saved.demoSales.id, businessDate, rows: rows.length, openingItems: Object.keys(opening).length, storage: 'R2' });
}

async function r2RevertDemoSales(env) {
  const value = await r2DemoState(env);
  const existed = Boolean(value.demoSales);
  value.demoSales = null;
  await r2SaveDemoState(env, value, 'sales-revert');
  return json({ reverted: existed, storage: 'R2' });
}

async function r2InitializeDemoOpening(env) {
  const value = await r2DemoState(env);
  if (!value.demoSales) throw new Error('请先生成演示销售，再建立首日全物料盘点。');
  const opening = {};
  for (const row of r2CalculateDemoLedger({ ...value.demoSales, opening: {} })) opening[`${normalizedKey(row.material_name)}|${row.unit}`] = demoOpeningQty(row.material_name, row.unit);
  value.demoSales.opening = opening;
  const saved = await r2SaveDemoState(env, value, 'opening-initialize');
  return json({ runId: saved.demoSales.id, openingItems: Object.keys(opening).length, storage: 'R2' });
}

async function r2FeishuSyncState(env) {
  const value = await r2DemoState(env);
  if (value.feishuImport?.sales?.length) return r2ImportedFeishuState(value);
  const demo = value.demoSales;
  const rows = demo?.rows || [];
  const ledger = demo ? r2AttachLatestPhysicalCounts(value, r2CalculateDemoLedger(demo), STORE_CODE, demo.business_date) : [];
  const materialMap = new Map();
  for (const row of ledger) materialMap.set(`${normalizedKey(row.material_name)}|${row.unit}`, row);
  const highlightSale = rows.find((row) => row.sku_code === HIGHLIGHT_DEMO_SKU) || null;
  const highlightRows = highlightSale ? (R2_DEMO_BOM[HIGHLIGHT_DEMO_SKU] || []).map(([material_name, unit, usage_per_sale]) => {
    const daily = materialMap.get(`${normalizedKey(material_name)}|${unit}`);
    const calculated_qty = r2Round(highlightSale.sales_qty * usage_per_sale);
    return {
      material_name, unit, usage_per_sale, calculated_qty,
      other_bom_consumption_qty: r2Round((daily?.bom_consumption_qty || 0) - calculated_qty),
      daily_bom_consumption_qty: daily?.bom_consumption_qty || calculated_qty,
      opening_qty: daily?.opening_qty ?? null,
      theoretical_closing_qty: daily?.theoretical_closing_qty ?? null,
      source_closing_qty: null,
      other_sku_contributors: (daily?.sku_contributors || []).filter((item) => item.sku_code !== HIGHLIGHT_DEMO_SKU)
    };
  }) : [];
  const totalSales = rows.reduce((sum, row) => sum + Number(row.sales_qty || 0), 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.sales_amount || 0), 0);
  const bomLines = Object.values(R2_DEMO_BOM).reduce((sum, lines) => sum + lines.length, 0);
  const latestBatch = demo ? { id: demo.id, status: 'completed', started_at: demo.created_at, completed_at: demo.created_at, scanned_records: rows.length, imported_records: rows.length, mapped_sales_records: rows.length, unmapped_sales_records: 0 } : null;
  return {
    source: { name: '飞书原始数据 + R2 可重置演示数据', tables: ['门店销售明细', '商品SKU主档', '商品BOM', '门店库存台账'], syncSchedule: '飞书每 10 分钟读取至 R2；演示数据按操作即时回算' },
    latestBatch, coverage: demo ? 100 : 0,
    mapping: { product_skus: R2_PRODUCT_MASTERS.length, bom_skus: Object.keys(R2_DEMO_BOM).length, bom_lines: bomLines, brand_real_skus: R2_REAL_PRODUCT_SKUS.length, mvp_mock_bom_skus: Object.keys(R2_DEMO_BOM).filter((sku) => !R2_REAL_PRODUCT_SKU_SET.has(sku)).length },
    demo: demo ? { id: demo.id, business_date: demo.business_date, created_at: demo.created_at, records: rows.length, sales_qty: totalSales } : null,
    demoBaseline: demo ? { counted_date: demo.counted_date, effective_business_date: demo.business_date, material_count: Object.keys(demo.opening || {}).length } : null,
    groups: demo ? [{ store_code: STORE_CODE, business_date: demo.business_date, sales_lines: rows.length, sales_qty: totalSales, sales_amount: totalAmount }] : [],
    latestGroup: demo ? { store_code: STORE_CODE, business_date: demo.business_date } : null,
    materials: ledger.map((row) => ({ material_name: row.material_name, unit: row.unit, theoretical_qty: row.bom_consumption_qty, source_sales_qty: row.source_sales_qty })),
    ledger, materialAnomalies: [], diagnosisCases: value.diagnosisCases || [], diagnosisKnowledge: value.diagnosisKnowledge || [], unmappedSkus: [], transfers: { demo_orders: value.transferOrders || [], store_requests: value.storeTransferRequests || [], inventory_archives: value.transferArchives || [], records: [] }, highlight: highlightSale ? { sale: highlightSale, rows: highlightRows } : null,
    calculation: { formula: '首日实盘期初 + 入库 + 调拨入 − 调拨出 − 报损 − 所有销售 SKU × BOM 用量 = 理论期末', rollover: 'R2 演示先建立首日全物料实盘基线；后续销售按 SKU 拆解并汇总到物料。', writeback: 'R2 演示状态不回写飞书，D1 恢复后可再接入正式同步批次。' },
    storage: value.storage,
    r2Import: value.feishuImport || null,
    masterDataQuality: r2MasterDataQuality(value)
  };
}

// 门店移动端只需要当天、当前门店的任务和少量库存字段。
// 避免三个前端模块分别下载完整 R2 状态与飞书导入快照。
async function r2StoreBootstrap(env, storeCode = STORE_CODE) {
  const value = await r2DemoState(env);
  const storeMaster = (value.storeMasters || []).find((item) => item.store_code === storeCode)
    || { store_code: storeCode, store_name: storeCode, region: '未设置', status: '未设置', store_role: '门店', franchisee: '' };
  const calculated = value.feishuImport?.sales?.length ? r2ImportedFeishuState(value) : null;
  const view = (calculated?.storeViews || []).find((item) => item.store_code === storeCode)
    || (storeCode === STORE_CODE ? calculated?.storeViews?.[0] : null);
  const businessDate = view?.business_date || value.feishuImport?.latest_business_date || chinaBusinessDate();
  // 研判衍生的“补凭证”由总部研判中心跟踪，不作为门店移动端的日常待办展示。
  // 门店首页仅保留独立、可执行的运营任务，避免旧研判信息淹没收货、调拨和盘点。
  const operationTasks = (value.operationTasks || [])
    .filter((item) => (item.store_code || item.assigned_store_code || STORE_CODE) === storeCode
      && !item.source_case_id && item.task_type !== 'receipt_evidence')
    .slice(0, 20);
  const countPlans = (value.countPlans || [])
    .filter((item) => item.store_code === storeCode && item.business_date === businessDate)
    .slice(0, 20);
  const countPhotoReviews = (value.countPhotoReviews || [])
    .filter((item) => item.store_code === storeCode && item.business_date === businessDate)
    .slice(0, 10)
    .map(({ preview_data, ...review }) => review);
  const documents = (value.documents || [])
    .filter((item) => (item.store_code || STORE_CODE) === storeCode && item.business_date === businessDate)
    .slice(0, 20)
    .map(({ preview_data, ...document }) => document);
  const storeTransferRequests = (value.storeTransferRequests || [])
    .filter((item) => item.from_store_code === storeCode || item.to_store_code === storeCode)
    .slice(0, 50);
  const materialAnomalies = (value.materialAnomalies || [])
    .filter((item) => item.store_code === storeCode && (!businessDate || item.business_date === businessDate))
    .map((item) => ({ id: item.id, status: item.status, severity: item.severity }));
  const materialEvents = (value.materialEvents || [])
    .filter((item) => item.store_code === storeCode && (!businessDate || item.business_date === businessDate))
    .slice(0, 50);
  const purchaseOrders = (value.purchaseOrders || [])
    .filter((item) => item.store_code === storeCode)
    .slice(0, 30);
  const receiptOrders = (value.receiptOrders || [])
    .filter((item) => item.store_code === storeCode)
    .slice(0, 30);
  const ledger = (view?.ledger || []).map((row) => ({
    material_name: row.material_name,
    unit: row.unit,
    theoretical_closing_qty: row.theoretical_closing_qty,
    safety_qty: row.safety_qty ?? null
  }));
  return {
    storeCode,
    storeMaster,
    safetyStockPolicies: (value.safetyStockPolicies || []).filter((item) => item.store_code === storeCode && item.status !== 'inactive'),
    businessDate,
    task: value.task?.store_code === storeCode ? value.task : null,
    operationTask: operationTasks.find((item) => item.status !== 'closed') || operationTasks[0] || null,
    operationTasks,
    countPlans,
    countPhotoReviews,
    documents,
    materialAnomalies,
    materialEvents,
    purchaseOrders,
    receiptOrders,
    storeTransferRequests,
    transfers: { store_requests: storeTransferRequests },
    ledger,
    materialCatalog: (value.materialCatalog || r2DefaultMaterialCatalog()).filter((item) => item.status !== 'inactive'),
    feishuImport: {
      latest_business_date: businessDate,
      latest_sales_qty: view?.sales_qty || 0,
      imported_at: value.feishuImport?.imported_at || null
    },
    storage: value.storage
  };
}

function r2StoreAgentTodayTasks(bootstrap, storeCode) {
  const tasks = [];
  for (const plan of (bootstrap.countPlans || []).filter((item) => item.status === 'pending_store_count')) {
    const target = plan.target_material_name || (Array.isArray(plan.target_material_names) && plan.target_material_names.length ? plan.target_material_names.join('、') : '全物料');
    tasks.push({
      type: 'count', priority: 1, plan_no: plan.plan_no, title: `${target}盘点`,
      detail: `${plan.plan_no} · ${Number(plan.material_count || 0)} 项待盘`,
      action: { type: 'open_count', prefill: { plan_no: plan.plan_no, material_name: plan.target_material_name || '' } }
    });
  }
  for (const request of (bootstrap.storeTransferRequests || []).filter((item) => item.to_store_code === storeCode && item.status === 'pending_receipt')) {
    tasks.push({
      type: 'transfer_receipt', priority: 2, request_id: request.id, title: '确认调入收货',
      detail: `${request.from_store_code} · ${request.material_name} ${request.qty}${request.unit}`,
      action: { type: 'open_transfer', prefill: { direction: 'inbound', request_id: request.id } }
    });
  }
  for (const task of (bootstrap.operationTasks || []).filter((item) => item.status === 'pending_store_submission')) {
    tasks.push({ type: 'operation', priority: 3, task_id: task.id, title: task.title || '门店运营任务', detail: task.instruction || '请按任务要求提交照片凭证。', action: { type: 'open_task_tab' } });
  }
  return tasks.sort((left, right) => left.priority - right.priority).slice(0, 6);
}

function r2StoreAgentTodayTaskReply(storeCode, tasks) {
  if (!tasks.length) return `${storeCode} 今天没有待完成任务。需要登记调拨、报损、收货、盘点或查库存时，直接告诉我即可。`;
  const first = tasks[0];
  return `${storeCode} 今天有 ${tasks.length} 项待办。优先完成：${first.title}（${first.detail}）。我可以带你完成；盘点只需上传照片，识别后再确认异常或不清晰的项目。`;
}

// 演示主档由系统 R2 管理，不从飞书表回写或读取。此接口用于将确认过的主档
// 一次性覆盖到演示态，业务流水、盘点、研判和历史知识均保持原样。
async function r2SyncStoreMasters(env) {
  const value = await r2DemoState(env);
  value.storeMasters = r2DefaultStoreMasters();
  r2Audit(value, '总部运营', '更新门店主档', `已更新 ${value.storeMasters.length} 家门店主档（名称、区域、状态、门店角色、加盟商）；未改动业务流水。`);
  const stateValue = await r2SaveDemoState(env, value, 'store-master-sync');
  return json({ store_masters: stateValue.storeMasters, storage: stateValue.storage });
}

async function r2SyncProductCatalog(env) {
  const value = await r2DemoState(env);
  value.productCatalog = r2DefaultProductCatalog();
  r2Audit(value, '总部运营', '更新商品主档', `已更新 ${value.productCatalog.length} 个 SKU（6 个 Brown Sugar 品牌真实商品，其余标记为 MVP Mock）；未修改销售或库存流水。`);
  const stateValue = await r2SaveDemoState(env, value, 'product-catalog-sync');
  return json({ product_catalog: stateValue.productCatalog, storage: stateValue.storage });
}

async function r2SyncMaterialCatalog(env) {
  const value = await r2DemoState(env);
  value.materialCatalog = r2DefaultMaterialCatalog();
  const alignedPolicies = r2AlignSafetyStockPolicies(value.safetyStockPolicies, value.materialCatalog);
  value.safetyStockPolicies = alignedPolicies.policies;
  r2Audit(value, '总部运营', '更新物料主档', `已更新 ${value.materialCatalog.length} 项物料的基础单位、采购单位、换算系数、备注与品牌；同步换算 ${alignedPolicies.converted} 条安全库存策略至基础单位。历史库存流水和已锁定销售快照保持原单位、原数量。`);
  const stateValue = await r2SaveDemoState(env, value, 'material-catalog-sync');
  return json({ material_catalog: stateValue.materialCatalog, storage: stateValue.storage });
}

async function r2UpdateMaterialCountPolicies(env, body = {}) {
  const value = await r2DemoState(env);
  value.materialCatalog = value.materialCatalog?.length ? value.materialCatalog : r2DefaultMaterialCatalog();
  const updates = Array.isArray(body.updates) ? body.updates : [body];
  const changed = [];
  for (const update of updates) {
    const materialName = String(update?.material_name || '').trim().slice(0, 80);
    const policy = update?.count_policy === 'daily' ? 'daily' : update?.count_policy === 'optional' ? 'optional' : null;
    const material = value.materialCatalog.find((item) => normalizedKey(item.material_name) === normalizedKey(materialName));
    if (!material || !policy) continue;
    material.count_policy = policy;
    material.daily_count_enabled = policy === 'daily';
    material.updated_at = now();
    changed.push({ material_name: material.material_name, count_policy: policy });
  }
  if (!changed.length) return bad('请选择有效物料并设置为每日盘点或按需盘点。');
  r2Audit(value, '总部运营', '更新物料盘点属性', changed.map((item) => `${item.material_name}=${item.count_policy === 'daily' ? '每日盘点' : '按需盘点'}`).join('；'), 'material-count-policy');
  const stateValue = await r2SaveDemoState(env, value, 'material-count-policy-update');
  return json({ updated: changed, material_catalog: stateValue.materialCatalog, storage: stateValue.storage });
}

async function r2CreateManualCountPlan(env, body = {}) {
  const value = await r2DemoState(env);
  const storeCode = String(body.store_code || STORE_CODE).trim().slice(0, 64);
  const store = (value.storeMasters || r2DefaultStoreMasters()).find((item) => item.store_code === storeCode && item.status !== '停用');
  if (!store) return bad('请选择有效门店。');
  const names = [...new Set((Array.isArray(body.material_names) ? body.material_names : []).map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 80);
  if (!names.length) return bad('请至少选择一个盘点物料。');
  const businessDate = String(body.business_date || value.feishuImport?.latest_business_date || chinaBusinessDate()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) return bad('盘点日期格式不正确。');
  const calculated = value.feishuImport?.sales?.length ? r2ImportedFeishuState(value) : { storeViews: [] };
  const view = (calculated.storeViews || []).find((item) => item.store_code === storeCode);
  const catalog = value.materialCatalog?.length ? value.materialCatalog : r2DefaultMaterialCatalog();
  const lines = names.map((materialName) => {
    const master = catalog.find((item) => normalizedKey(item.material_name) === normalizedKey(materialName) && item.status !== 'inactive');
    if (!master) return null;
    const ledgerRow = (view?.ledger || []).find((item) => normalizedKey(item.material_name) === normalizedKey(master.material_name));
    return {
      material_name: master.material_name,
      unit: ledgerRow?.unit || master.base_unit,
      theoretical_qty: Number(ledgerRow?.theoretical_closing_qty || 0),
      safety_qty: ledgerRow?.safety_qty ?? null,
      source: ledgerRow ? '总部手动盘点下发时理论库存快照' : '主档物料（当前门店尚无库存流水）'
    };
  }).filter(Boolean);
  if (!lines.length) return bad('所选物料均未在有效物料主档中。');
  const sourceType = body.source_type === 'work_order' ? 'work_order' : 'manual';
  const suffix = crypto.randomUUID().slice(0, 5).toUpperCase();
  const planNo = `PD-${businessDate.replaceAll('-', '')}-${storeCode}-${sourceType === 'work_order' ? 'WO' : 'MAN'}-${suffix}`;
  const plan = {
    id: planNo, plan_no: planNo, plan_type: sourceType === 'work_order' ? 'work_order_material_set' : 'manual_material_set',
    store_code: storeCode, business_date: businessDate, status: 'pending_store_count',
    created_at: now(), generated_by: '总部运营', material_count: lines.length, lines,
    submitted_material_count: 0, theoretical_snapshot_at: now(), snapshot_revision: 1,
    source_work_order_id: String(body.source_work_order_id || '').trim().slice(0, 120) || null,
    instruction: String(body.instruction || '').trim().slice(0, 240) || '请完成所选物料盘点并上传盘点照片。'
  };
  value.countPlans.unshift(plan);
  r2Audit(value, '总部运营', sourceType === 'work_order' ? '从工单下发盘点' : '下发不定期盘点', `${plan.plan_no} · ${storeCode} · ${lines.map((item) => item.material_name).join('、')}`, plan.id);
  const state = await r2SaveDemoState(env, value, 'manual-count-plan-create');
  return json({ plan, countPlans: state.countPlans, storage: state.storage }, 201);
}

async function r2SyncSafetyStockPolicies(env) {
  const value = await r2DemoState(env);
  value.safetyStockPolicies = r2DefaultSafetyStockPolicies();
  r2Audit(value, '总部运营', '新建安全库存配置', `已建立 ${value.safetyStockPolicies.length} 条门店物料安全库存策略；仅作为补货预警与调拨余量下限，不修改期初和库存流水。`);
  const stateValue = await r2SaveDemoState(env, value, 'safety-stock-policy-sync');
  return json({ safety_stock_policies: stateValue.safetyStockPolicies, storage: stateValue.storage });
}

async function r2CountEvidence(env, planNo, documentId = '') {
  const value = await r2DemoState(env);
  const plan = (value.countPlans || []).find((item) => item.plan_no === planNo || item.id === planNo);
  const document = (value.documents || []).find((item) => item.id === (documentId || plan?.document_id));
  if (!plan && !document) return null;
  const actualByKey = new Map((document?.lines || []).map((line) => [`${normalizedKey(line.material_name)}|${line.unit}`, line]));
  const sourceLines = plan?.lines?.length ? plan.lines : (document?.lines || []).map((line) => ({ material_name: line.material_name, unit: line.unit, theoretical_qty: line.theoretical_qty }));
  const lines = sourceLines.map((line) => {
    const actualLine = actualByKey.get(`${normalizedKey(line.material_name)}|${line.unit}`);
    const theoretical = Number(line.theoretical_qty || 0);
    const actual = actualLine?.actual_qty == null ? null : Number(actualLine.actual_qty);
    const delta = actual == null ? null : r2Round(actual - theoretical);
    const threshold = r2VarianceThreshold({ material_name: line.material_name, unit: line.unit, theoretical_closing_qty: theoretical });
    const exceeded = delta != null && Math.abs(delta) > threshold;
    const ratio = theoretical ? actual / theoretical : null;
    let finding = '盘点结果在允许阈值内';
    let findingCode = 'matched';
    if (actual == null) { finding = '未读取到实际盘点数量'; findingCode = 'missing'; }
    else if (exceeded && ratio != null && ((ratio >= 0.095 && ratio <= 0.105) || (ratio >= 9.5 && ratio <= 10.5))) { finding = '疑似小数点、单位或数量位数录入错误'; findingCode = 'entry_error'; }
    else if (exceeded && actual < theoretical) { finding = '盘亏：疑似未登记损耗、漏收货或盘点少录'; findingCode = 'shortage'; }
    else if (exceeded) { finding = '盘盈：疑似收货漏录、重复录入或盘点多录'; findingCode = 'surplus'; }
    return {
      material_name: line.material_name, unit: line.unit,
      theoretical_qty: theoretical, actual_qty: actual, delta, threshold, exceeded,
      finding, finding_code: findingCode, match_status: actualLine?.match_status || (exceeded ? 'variance' : 'matched')
    };
  });
  const abnormal = lines.filter((line) => line.exceeded || line.actual_qty == null);
  return {
    plan: plan ? {
      plan_no: plan.plan_no, plan_type: plan.plan_type || 'daily', parent_case_no: plan.parent_case_no || null,
      store_code: plan.store_code, business_date: plan.business_date, material_count: plan.material_count,
      generated_by: plan.generated_by, created_at: plan.created_at, status: plan.status
    } : null,
    document: document ? {
      id: document.id, original_filename: document.original_filename, received_at: document.received_at,
      ocr_status: document.ocr_status, ocr_confidence: document.ocr_confidence, note: document.note
    } : null,
    summary: { counted: lines.filter((line) => line.actual_qty != null).length, abnormal: abnormal.length, matched: lines.length - abnormal.length },
    lines
  };
}

function r2ReconcileMaterialDiagnosis(value, ledger, businessDate, storeCode, sourceBatchId, updatedAt) {
  const prior = Array.isArray(value.materialAnomalies) ? value.materialAnomalies : [];
  const candidates = new Map();
  for (const row of ledger) {
    const safetyQty = row.safety_qty ?? null;
    const negativeTolerance = R2_NEGATIVE_TOLERANCE_BY_UNIT[row.unit] ?? 0;
    const safetyTolerance = safetyQty == null ? 0 : Math.max(negativeTolerance, r2Round(safetyQty * 0.1));
    const physicalQty = row.actual_inventory_qty == null ? null : Number(row.actual_inventory_qty);
    const physicalDelta = physicalQty == null ? null : r2Round(physicalQty - Number(row.theoretical_closing_qty || 0));
    const varianceThreshold = r2VarianceThreshold(row);
    const theoreticalQty = Number(row.theoretical_closing_qty || 0);
    const receiptQty = Number(row.receipt_qty || 0);
    const consumptionQty = Number(row.bom_consumption_qty || 0);
    const sellInRatio = receiptQty > 0 ? r2Round(consumptionQty / receiptQty) : null;
    const evidence = {
      opening_source: row.baseline_source || '未标注',
      opening_qty: Number(row.opening_qty || 0),
      prior_closing_qty: row.prior_closing_qty ?? null,
      prior_closing_source: row.prior_closing_source || null,
      prior_negative_sales: row.prior_closing_qty != null && Number(row.prior_closing_qty) < 0,
      receipt_status: row.receipt_evidence_status || 'no_record',
      receipt_note: row.receipt_evidence_note || '当前未找到收货流水，不能直接判定为未收货',
      receipt_qty: Number(row.receipt_qty || 0),
      transfer_in_qty: Number(row.transfer_in_qty || 0),
      transfer_out_qty: Number(row.transfer_out_qty || 0),
      scrap_qty: Number(row.scrap_qty || 0),
      bom_consumption_qty: consumptionQty,
      physical_qty: physicalQty,
      physical_delta: physicalDelta,
      variance_threshold: varianceThreshold,
      theoretical_qty: theoreticalQty,
      sell_in_ratio: sellInRatio,
      actual_count_document_id: row.actual_inventory_document_id || null,
      actual_counted_at: row.actual_inventory_at || null
    };
    let candidate = null;
    // MVP 只保留四类可追溯规则。优先级：D2 负库存 > D1 实盘差异 > S1 安全库存 > T2 销入比。
    // 规则只输出“最优待验证位置”，不自动定责、推送、建工单或写库存。
    if (theoreticalQty < -negativeTolerance || Number(row.opening_qty || 0) < -negativeTolerance) {
      candidate = { rule_code: 'NEGATIVE_THEORETICAL', severity: 'high', strategy: 'verify_receipt_or_order', owner: '门店执行 / 总部运营', status: 'open', evidence: `理论期末 ${theoreticalQty}${row.unit}，低于负库存容差 ${negativeTolerance}${row.unit}；优先核对到货、收货录入和订货。` };
    } else if (physicalQty != null && Math.abs(physicalDelta) > varianceThreshold) {
      candidate = { rule_code: 'COUNT_VARIANCE', severity: Math.abs(physicalDelta) > Math.max(varianceThreshold * 5, 0.001) ? 'high' : 'mid', strategy: 'verify_count_or_receipt', owner: '门店执行', status: 'open', evidence: `实盘 ${physicalQty}${row.unit} 与理论 ${theoreticalQty}${row.unit} 相差 ${physicalDelta > 0 ? '+' : ''}${physicalDelta}${row.unit}，超过 ${varianceThreshold}${row.unit} 阈值。` };
    } else if (safetyQty != null && theoreticalQty < safetyQty - safetyTolerance) {
      candidate = { rule_code: 'BELOW_SAFETY_STOCK', severity: 'mid', strategy: 'verify_restock', owner: '门店补货 / 供应保障', status: 'open', evidence: `理论期末 ${theoreticalQty}${row.unit}，低于安全库存 ${safetyQty}${row.unit}（预警容差 ${safetyTolerance}${row.unit}）。` };
    } else if (sellInRatio != null && (sellInRatio > 2 || sellInRatio < 0.3)) {
      candidate = { rule_code: 'SELL_IN_IMBALANCE', severity: sellInRatio > 2 ? 'high' : 'mid', strategy: 'verify_restock_cycle', owner: '门店补货 / 商品运营', status: 'open', evidence: `本期 BOM 消耗 ${consumptionQty}${row.unit}，收货 ${receiptQty}${row.unit}，销入比 ${sellInRatio}，超出 MVP 阈值。` };
    }
    if (!candidate) continue;
    const key = `${storeCode}|${businessDate}|${normalizedKey(row.material_name)}|${candidate.rule_code}`;
    const existing = prior.find((item) => `${item.store_code}|${item.business_date}|${normalizedKey(item.material_name)}|${item.rule_code}` === key);
    candidates.set(key, { ...existing, ...candidate, id: existing?.id || id('MAT'), judgment_task_no: existing?.judgment_task_no || id('JDG'), store_code: storeCode, business_date: businessDate, material_name: row.material_name, unit: row.unit, theoretical_closing_qty: theoreticalQty, safety_qty: safetyQty, source_batch_id: sourceBatchId, evidence_detail: evidence, industry_assessment: null, mvp_action: existing?.mvp_action || null, created_at: existing?.created_at || updatedAt, updated_at: updatedAt, closed_at: null, closure_reason: null, reopened_at: null });
  }
  const retained = prior.map((item) => {
    if (item.store_code !== storeCode || item.business_date !== businessDate || ['closed', 'auto_closed'].includes(item.status)) return item;
    const key = `${item.store_code}|${item.business_date}|${normalizedKey(item.material_name)}|${item.rule_code}`;
    return candidates.has(key) ? null : { ...item, status: 'auto_closed', closed_at: updatedAt, closure_reason: '重新回算后该库存规则不再触发。', updated_at: updatedAt };
  }).filter(Boolean);
  value.materialAnomalies = [...Array.from(candidates.values()), ...retained.filter((item) => !candidates.has(`${item.store_code}|${item.business_date}|${normalizedKey(item.material_name)}|${item.rule_code}`))]
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  return value.materialAnomalies;
}

// 物料台账只负责识别信号；日结研判单按“门店 + 连续经营日”聚合这些信号。
// 因此，同一门店昨天未解决、今天仍触发的问题会追加观察记录，而不是再生一串物料任务。
function r2SimilarDiagnosisKnowledge(value, storeCode, signals) {
  const materialKeys = new Set(signals.map((item) => normalizedKey(item.material_name)));
  const ruleCodes = new Set(signals.map((item) => item.rule_code));
  const profileCodes = new Set(signals.map((item) => item.industry_assessment?.profile?.code).filter(Boolean));
  return (value.diagnosisKnowledge || []).map((entry) => {
    const materialMatch = (entry.materials || []).some((item) => materialKeys.has(normalizedKey(item)));
    const ruleMatch = (entry.rule_codes || []).some((item) => ruleCodes.has(item));
    const profileMatch = (entry.profile_codes || []).some((item) => profileCodes.has(item));
    const score = (materialMatch ? 4 : 0) + (ruleMatch ? 3 : 0) + (profileMatch ? 2 : 0) + (entry.store_code === storeCode ? 1 : 0);
    return { ...entry, similarity_score: score, match_reason: [materialMatch ? '同物料' : '', ruleMatch ? '同规则' : '', profileMatch ? '同行业类型' : '', entry.store_code === storeCode ? '同门店' : ''].filter(Boolean).join('、') };
  }).filter((entry) => entry.similarity_score >= 3).sort((left, right) => right.similarity_score - left.similarity_score || String(right.closed_at).localeCompare(String(left.closed_at))).slice(0, 3);
}

function r2RefreshStoreDailyDiagnosisCases(value, businessDate, updatedAt = now()) {
  const activeSignals = (value.materialAnomalies || []).filter((item) =>
    item.business_date === businessDate && !['closed', 'auto_closed'].includes(item.status)
  );
  const byStore = new Map();
  for (const signal of activeSignals) {
    if (!signal.store_code) continue;
    const rows = byStore.get(signal.store_code) || [];
    rows.push(signal); byStore.set(signal.store_code, rows);
  }
  const existingCases = Array.isArray(value.diagnosisCases) ? value.diagnosisCases : [];
  for (const [storeCode, signals] of byStore) {
    const baseline = signals.filter((item) => item.rule_code === 'BASELINE_INVALID');
    const negative = signals.filter((item) => item.rule_code === 'NEGATIVE_THEORETICAL');
    const countVariance = signals.filter((item) => item.rule_code === 'COUNT_VARIANCE');
    const safety = signals.filter((item) => item.rule_code === 'BELOW_SAFETY_STOCK');
    const broadRisk = signals.length >= 3 || baseline.length >= 2;
    const scope = broadRisk ? 'full_store_count' : countVariance.length ? 'count_variance_review' : baseline.length ? 'ledger_data_governance' : negative.length ? 'targeted_material_check' : 'supply_action';
    const severity = baseline.length || negative.length || countVariance.length ? 'high' : 'mid';
    const primaryMaterials = signals.slice(0, 6).map((item) => `${item.material_name}${item.unit ? `（${item.unit}）` : ''}`);
    const industryJudgments = signals.map((item) => ({ material_name: item.material_name, unit: item.unit, rule_code: item.rule_code, profile: item.industry_assessment?.profile || null, confidence: item.industry_assessment?.confidence || 'low', conclusion: item.industry_assessment?.conclusion || '', next_step: item.industry_assessment?.next_step || null, checks: item.industry_assessment?.checks || [] }));
    const similarKnowledge = r2SimilarDiagnosisKnowledge(value, storeCode, signals);
    const hypotheses = [
      ...(baseline.length ? [{ code: 'historical_baseline', owner: '总部数据 / 供应链', title: '期初与历史台账基线异常', reason: `${baseline.length} 项物料有效期初为负，优先核对昨日固化期末、收货漏录、单位与首日盘点。` }] : []),
      ...(signals.some((item) => item.evidence_detail?.prior_negative_sales) ? [{ code: 'prior_negative_sales', owner: '总部营运', title: '上一个周期已发生负库存销售', reason: '历史期末已为负，当前负数可能是上一周期遗留；先查看上一营业日台账与销售 BOM，不直接重复下发盘点。' }] : []),
      ...(signals.some((item) => item.evidence_detail?.receipt_status === 'no_record') && (baseline.length || negative.length) ? [{ code: 'receipt_evidence_missing', owner: '总部供应链 + 门店', title: '收货证据不足', reason: '当前未找到对应收货流水，只能提示“证据不足”，不能直接认定门店未收货；请补齐收货单号或核对飞书收货表。' }] : []),
      ...(signals.some((item) => /待首日盘点|未配置/.test(item.evidence_detail?.opening_source || '')) ? [{ code: 'system_opening', owner: '总部数据', title: '系统期初基线待确认', reason: '期初来自首日基线或尚未配置的来源，需核对基线日期、单位与物料主数据。' }] : []),
      ...(countVariance.length ? [
        { code: 'count_bom_missing', owner: '总部商品 / 数据', title: 'BOM 配方或映射未维护', reason: '先检查该物料关联的销售 SKU 是否全部有 BOM、配方版本和单位换算是否正确。' },
        { code: 'count_receipt_gap', owner: '总部供应链 + 门店', title: '收货或调拨流水缺失', reason: '再对照收货单、调拨单和库存流水；没有对应记录时只能标记证据不足，不能直接判定门店未收货。' },
        { code: 'count_entry_error', owner: '门店', title: '盘点单位或数量录入错误', reason: '最后核对门店实盘拍照、单位和数量录入；仍无法解释时再下发同一物料的定向盘点。' }
      ] : []),
      ...(negative.length ? [{ code: 'missing_receipt_or_bom', owner: '总部营运 + 门店', title: '收货、BOM 或单位口径待核验', reason: `${negative.length} 项物料理 论期末为负，需要对照销售 BOM、收货和报损流水。` }] : []),
      ...(safety.length ? [{ code: 'supply_risk', owner: '供应链 / 门店', title: '低于安全库存', reason: `${safety.length} 项物料低于安全库存，应补货或调拨并在下一次回算中验证。` }] : [])
    ];
    const actions = broadRisk
      ? [{ type: 'ledger_governance', label: '总部先复核历史期末、收货与单位', owner: '总部数据 / 供应链', status: 'recommended' }, { type: 'full_inventory_count', label: `排除前置原因后下发 ${signals.length} 项异常物料盘点`, owner: `${storeCode} 店长`, status: 'fallback' }]
      : scope === 'count_variance_review'
        ? [{ type: 'material_detail', label: '查看差异物料的收货、BOM 与盘点证据', owner: '总部营运', status: 'recommended' }, { type: 'targeted_count', label: '前置原因排除后下发差异物料定向盘点', owner: `${storeCode} 店长`, status: 'fallback' }]
      : scope === 'ledger_data_governance'
        ? [{ type: 'ledger_governance', label: '总部校验历史期末、收货和单位口径', owner: '总部数据 / 供应链', status: 'recommended' }, { type: 'targeted_count', label: '必要时下发重点物料复盘', owner: `${storeCode} 店长`, status: 'optional' }]
        : scope === 'targeted_material_check'
          ? [{ type: 'targeted_count', label: '下发异常物料定向盘点', owner: `${storeCode} 店长`, status: 'recommended' }, { type: 'bom_review', label: '核验 BOM、单位和销售映射', owner: '总部商品 / 数据', status: 'recommended' }]
          : [{ type: 'replenish_or_transfer', label: '创建补货或调拨动作', owner: '供应链 / 门店', status: 'recommended' }];
    let caseItem = existingCases.find((item) => item.case_type === 'store_daily' && item.store_code === storeCode && item.status !== 'closed');
    const observation = {
      business_date: businessDate, observed_at: updatedAt, signal_ids: signals.map((item) => item.id),
      signal_count: signals.length, summary: `${signals.length} 条物料信号：${primaryMaterials.join('、')}`
    };
    if (!caseItem) {
      caseItem = {
        id: id('DGN'), case_no: `DGN-${storeCode}-${businessDate.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
        case_type: 'store_daily', store_code: storeCode, opened_business_date: businessDate, latest_business_date: businessDate,
        status: 'open', severity, scope, signal_ids: observation.signal_ids, signal_count: signals.length,
        materials: primaryMaterials, root_hypotheses: hypotheses, recommended_actions: actions, industry_judgments: industryJudgments, similar_knowledge: similarKnowledge,
        observations: [observation], created_at: updatedAt, updated_at: updatedAt, dispatched_count_plan_no: null
      };
      existingCases.unshift(caseItem);
      r2Audit(value, '系统日结研判', '生成门店日结研判单', `${caseItem.case_no} · ${storeCode} · 聚合 ${signals.length} 条物料信号，建议：${actions[0]?.label || '复核'}。`, caseItem.id);
      continue;
    }
    const lastObservation = (caseItem.observations || [])[0];
    const sameObservation = lastObservation?.business_date === businessDate && (lastObservation?.signal_ids || []).join('|') === observation.signal_ids.join('|');
    caseItem.latest_business_date = businessDate; caseItem.severity = severity; caseItem.scope = scope;
    caseItem.signal_ids = observation.signal_ids; caseItem.signal_count = signals.length; caseItem.materials = primaryMaterials;
    const previousActions = caseItem.recommended_actions || [];
    caseItem.root_hypotheses = hypotheses; caseItem.recommended_actions = actions.map((action) => {
      const previous = previousActions.find((item) => item.type === action.type);
      return previous && ['dispatched', 'completed'].includes(previous.status) ? { ...action, ...previous } : action;
    }); caseItem.industry_judgments = industryJudgments; caseItem.similar_knowledge = similarKnowledge; caseItem.updated_at = updatedAt;
    if (!sameObservation) {
      caseItem.observations = [observation, ...(caseItem.observations || [])];
      r2Audit(value, '系统日结研判', '追加日结研判观察', `${caseItem.case_no} · ${businessDate} 仍有 ${signals.length} 条物料信号，沿用未关闭研判单。`, caseItem.id);
    }
  }
  // 第二层：只有同一物料在至少两家门店的同一营业日均触发时，才生成跨门店物料研判单。
  // 这类问题优先归因到 BOM、单位、物料主数据或供应链口径，而不是让每家门店各自反复盘点。
  const byMaterial = new Map();
  for (const signal of activeSignals) {
    const key = `${normalizedKey(signal.material_name)}|${signal.unit || ''}`;
    const rows = byMaterial.get(key) || []; rows.push(signal); byMaterial.set(key, rows);
  }
  for (const signals of byMaterial.values()) {
    const stores = Array.from(new Set(signals.map((item) => item.store_code))).sort();
    if (stores.length < 2) continue;
    const prototype = signals[0];
    let caseItem = existingCases.find((item) => item.case_type === 'material_cross_store' && normalizedKey(item.material_name) === normalizedKey(prototype.material_name) && item.unit === prototype.unit && item.status !== 'closed');
    const observation = { business_date: businessDate, observed_at: updatedAt, signal_ids: signals.map((item) => item.id), store_codes: stores, signal_count: signals.length, summary: `${prototype.material_name} 在 ${stores.join('、')} 共触发 ${signals.length} 条库存信号。` };
    const hypotheses = [
      { code: 'bom_or_unit', owner: '总部商品 / 数据', title: 'BOM、单位或物料映射口径异常', reason: `同一物料在 ${stores.length} 家门店同时触发，优先核验配方版本、单位换算和 SKU 映射。` },
      { code: 'supply_or_receipt', owner: '供应链 / 加盟商', title: '收货或供应链入账口径异常', reason: '若配置无误，再比对各门店收货、调拨和期初滚动台账。' }
    ];
    const actions = [
      { type: 'bom_review', label: '总部核验 BOM、单位与物料映射', owner: '总部商品 / 数据', status: 'recommended' },
      { type: 'cross_store_targeted_count', label: `下发 ${stores.length} 家门店定向盘点`, owner: '相关门店店长', status: 'recommended' }
    ];
    if (!caseItem) {
      const forcedClosedSameDay = existingCases.find((item) => item.case_type === 'material_cross_store' && item.closure_mode === 'hq_forced' && item.latest_business_date === businessDate && normalizedKey(item.material_name) === normalizedKey(prototype.material_name) && item.unit === prototype.unit && (item.signal_ids || []).join('|') === observation.signal_ids.join('|'));
      if (forcedClosedSameDay) continue;
      caseItem = { id: id('DGN'), case_no: `DGN-MAT-${businessDate.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`, case_type: 'material_cross_store', material_name: prototype.material_name, unit: prototype.unit, store_codes: stores, opened_business_date: businessDate, latest_business_date: businessDate, status: 'open', severity: signals.some((item) => item.severity === 'high') ? 'high' : 'mid', scope: 'cross_store_material_governance', signal_ids: observation.signal_ids, signal_count: signals.length, root_hypotheses: hypotheses, recommended_actions: actions, observations: [observation], created_at: updatedAt, updated_at: updatedAt };
      existingCases.unshift(caseItem);
      r2Audit(value, '系统日结研判', '生成跨门店物料研判单', `${caseItem.case_no} · ${prototype.material_name} · ${stores.join('、')} 同时触发，建议先做总部配置核验。`, caseItem.id);
      continue;
    }
    const lastObservation = (caseItem.observations || [])[0];
    const sameObservation = lastObservation?.business_date === businessDate && (lastObservation?.signal_ids || []).join('|') === observation.signal_ids.join('|');
    caseItem.store_codes = stores; caseItem.latest_business_date = businessDate; caseItem.signal_ids = observation.signal_ids; caseItem.signal_count = signals.length; caseItem.root_hypotheses = hypotheses; caseItem.recommended_actions = actions; caseItem.updated_at = updatedAt;
    if (!sameObservation) { caseItem.observations = [observation, ...(caseItem.observations || [])]; r2Audit(value, '系统日结研判', '追加跨门店物料观察', `${caseItem.case_no} · ${businessDate} 仍涉及 ${stores.length} 家门店，沿用未关闭研判单。`, caseItem.id); }
  }
  value.diagnosisCases = existingCases.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  return value.diagnosisCases;
}

function r2ReconcileAllMaterialSignalsAndCases(value, businessDate, updatedAt = now()) {
  if (!value.feishuImport?.sales?.length) return [];
  const calculated = r2ImportedFeishuState(value);
  for (const view of calculated.storeViews || []) r2ReconcileMaterialDiagnosis(value, view.ledger, businessDate || view.business_date, view.store_code, value.feishuImport.id, updatedAt);
  // MVP 不再聚合复杂的日结/跨店研判单，避免重复归因与隐式工单。
  value.diagnosisCases = [];
  return value.materialAnomalies || [];
}

function r2LatestLedgerSnapshot(value, storeCode, businessDate, materialName, unit) {
  const materialKey = normalizedKey(materialName);
  return (value.ledgerSnapshots || [])
    .filter((snapshot) => snapshot.store_code === storeCode && snapshot.business_date < businessDate)
    .sort((left, right) => right.business_date.localeCompare(left.business_date))
    .flatMap((snapshot) => (snapshot.lines || []).map((line) => ({ ...line, snapshot_business_date: snapshot.business_date, snapshot_no: snapshot.snapshot_no })))
    .find((line) => normalizedKey(line.material_name) === materialKey && line.unit === unit) || null;
}

function r2FinalizePastLedger(value, asOfDate = chinaBusinessDate(), actor = '定时日结任务') {
  const imported = value.feishuImport;
  if (!imported?.latest_business_date || !imported.sales?.length || imported.latest_business_date >= asOfDate) return [];
  const calculated = r2ImportedFeishuState(value), created = [];
  for (const view of calculated.storeViews || []) {
    const exists = (value.ledgerSnapshots || []).some((snapshot) => snapshot.store_code === view.store_code && snapshot.business_date === view.business_date);
    if (exists || !view.ledger?.length) continue;
    const snapshot = {
      id: id('LGR'), snapshot_no: `LG-${view.business_date.replaceAll('-', '')}-${view.store_code}`,
      store_code: view.store_code, business_date: view.business_date, status: 'finalized',
      source_batch_id: imported.id, finalized_at: now(), finalized_by: actor,
      material_count: view.ledger.length,
      lines: view.ledger.map((row) => ({
        material_name: row.material_name, unit: row.unit,
        theoretical_closing_qty: row.theoretical_closing_qty,
        opening_qty: row.opening_qty, receipt_qty: row.receipt_qty,
        transfer_in_qty: row.transfer_in_qty, transfer_out_qty: row.transfer_out_qty,
        scrap_qty: row.scrap_qty, bom_consumption_qty: row.bom_consumption_qty
      }))
    };
    value.ledgerSnapshots.unshift(snapshot); created.push(snapshot);
    r2Audit(value, actor, '固化昨日物料台账期末', `${snapshot.snapshot_no} · ${view.store_code} · 冻结 ${snapshot.material_count} 项物料理论期末，供后续营业日期初回算。`, snapshot.id);
  }
  return created;
}

async function r2ImportFeishuSales(env, dispatchNotifications = false, force = false) {
  const current = await r2DemoState(env);
  const finalizedSnapshots = r2FinalizePastLedger(current);
  if (!force && current.feishuImport?.imported_at && Date.now() - Date.parse(current.feishuImport.imported_at) < 90_000) {
    if (dispatchNotifications) {
      await r2MaybeDispatchScheduledNotifications(env, current);
      return r2SaveDemoState(env, current, finalizedSnapshots.length ? 'scheduled-ledger-finalize' : 'scheduled-notification-check');
    }
    return finalizedSnapshots.length ? r2SaveDemoState(env, current, 'ledger-finalize') : current;
  }
  const token = await getFeishuTenantToken(env);
  // 仅读取销售表。所有库存期初、物料、BOM、收货、报损与调拨都由系统/R2
  // 演示链路维护，确保“重新初始化门店”不会被飞书历史数据再次覆盖。
  const [records, bomRecords, materialRecords] = await Promise.all([
    listFeishuRecords(token, FEISHU_SALES_TABLE_ID),
    listFeishuRecords(token, FEISHU_BOM_TABLE_ID),
    listFeishuRecords(token, FEISHU_MATERIAL_TABLE_ID)
  ]);
  const materialCatalog = current.materialCatalog?.length ? current.materialCatalog : r2DefaultMaterialCatalog();
  const importedAt = now();
  const localBomBySku = r2LocalBomBySku(materialCatalog);
  const liveBrandBom = r2FeishuBrandBomBySku(bomRecords, materialRecords, materialCatalog, importedAt);
  const bomBySku = liveBrandBom.complete
    ? { ...localBomBySku, ...liveBrandBom.bomBySku }
    : localBomBySku;
  const materialMaster = r2LocalMaterialMaster(materialCatalog);
  const productCatalog = current.productCatalog?.length ? current.productCatalog : r2DefaultProductCatalog();
  const productAliases = r2ProductCatalogAliases(productCatalog);
  const sales = records.map((record) => {
    const fields = record.fields || {};
    const directSku = feishuText(fields['SKU Code']), productName = feishuText(fields['商品']) || feishuText(fields['商品名称(OCR)']);
    const skuCode = r2ResolveLocalSku(directSku, productName, productAliases);
    return { record_id: record.record_id, store_code: feishuText(fields['门店编码关联']), business_date: feishuDate(fields['日期']), sku_code: skuCode, product_name: productName || r2ProductName(productCatalog, skuCode), sales_qty: feishuNumber(fields['销售数量']), sales_amount: feishuNumber(fields['销售金额']), data_classification: r2ProductDataClassification(skuCode) };
  }).filter((row) => row.record_id && row.store_code && row.business_date && row.sales_qty != null && row.sales_qty >= 0);
  const value = current;
  const latestDate = sales.reduce((date, row) => row.business_date > date ? row.business_date : date, '');
  const latestRows = sales.filter((row) => row.business_date === latestDate);
  const importId = id('R2-IMP');
  value.feishuImport = { id: importId, imported_at: importedAt, records: sales.length, latest_business_date: latestDate || null, latest_records: latestRows.length, latest_sales_qty: r2Round(latestRows.reduce((sum, row) => sum + row.sales_qty, 0)), sales, bom_by_sku: bomBySku, bom_lines: Object.values(bomBySku).reduce((sum, lines) => sum + lines.length, 0), product_skus: productCatalog.length, product_catalog: productCatalog, material_catalog: materialCatalog, material_master: materialMaster, ledger_source: [], opening: {}, opening_by_store: {}, bom_sync: { status: liveBrandBom.complete ? 'live' : 'snapshot_fallback', table_id: FEISHU_BOM_TABLE_ID, scanned_records: bomRecords.length, brand_sku_counts: liveBrandBom.counts, rejected_records: liveBrandBom.rejected.length, synced_at: importedAt, note: liveBrandBom.complete ? '已通过飞书应用只读获取 6 个 Brown Sugar SKU，每个 SKU 9 条有效 BOM。' : '飞书实时 BOM 未通过完整性门禁，本批次继续使用已验证快照。' }, transfer_source: { enabled: false, scanned_records: 0, valid_records: 0, records: [], note: '正式演示暂不读取飞书调拨；仅销售表参与同步。' }, source_policy: { sales: 'feishu_read_only', opening: 'system_initialized', product_catalog: 'system_master_with_feishu_classification', material_catalog: 'system_local', bom: liveBrandBom.complete ? 'feishu_live_brand_whitelist_plus_mvp_mock' : 'feishu_brand_snapshot_whitelist_plus_mvp_mock', receipts: 'system_events', scraps: 'system_events', transfers: 'system_events' } };
  for (const session of value.demoDaySessions || []) {
    if (session.status !== 'active' || session.business_date !== latestDate) continue;
    const storeSales = sales.filter((row) => row.store_code === session.store_code && row.business_date === session.business_date);
    if (!storeSales.length) continue;
    session.source_batch_id = importId; session.source_imported_at = importedAt; session.sales_record_count = storeSales.length;
    session.sales_locked_at = importedAt; session.locked_at = importedAt;
    session.locked_import = cloneDemoState(value.feishuImport);
  }
  const calculated = r2ImportedFeishuState(value);
  r2ReconcileAllMaterialSignalsAndCases(value, latestDate, value.feishuImport.imported_at);
  r2EnsureDailyCountPlans(value, r2ImportedFeishuState(value), '总部运营自动计划', chinaBusinessDate());
  if (dispatchNotifications) await r2MaybeDispatchScheduledNotifications(env, value);
  return r2SaveDemoState(env, value, 'feishu-sales-import');
}

function r2ImportedStoreView(value, storeCode, latestDate) {
  const demoDay = (value.demoDaySessions || []).find((item) => item.store_code === storeCode && item.business_date === latestDate && item.status === 'active');
  const imported = demoDay?.locked_import || value.feishuImport;
  const cleanSystemBaseline = Boolean(demoDay?.opening_initialized_at && demoDay?.opening_source === 'system_initialized_valid_baseline');
  const rows = imported.sales.filter((row) => row.business_date === latestDate && row.store_code === storeCode);
  const consumption = new Map(), unmapped = new Map();
  for (const sale of rows) {
    const bom = imported.bom_by_sku?.[sale.sku_code] || [];
    if (!bom.length) { const key = `${sale.sku_code}|${sale.product_name}`; const item = unmapped.get(key) || { sku_code: sale.sku_code || '未识别 SKU', product_name: sale.product_name || '未识别商品', sales_records: 0, sales_qty: 0 }; item.sales_records += 1; item.sales_qty += sale.sales_qty; unmapped.set(key, item); }
    for (const line of bom) { const key = `${normalizedKey(line.material_name)}|${line.unit}`; const item = consumption.get(key) || { material_name: line.material_name, unit: line.unit, theoretical_qty: 0, source_sales_qty: 0, sku_contributors: [] }; const qty = r2Round(sale.sales_qty * line.usage_per_sale); item.theoretical_qty = r2Round(item.theoretical_qty + qty); item.source_sales_qty += sale.sales_qty; item.sku_contributors.push({ ...sale, unit: line.unit, usage_per_sale: line.usage_per_sale, consumption_qty: qty }); consumption.set(key, item); }
  }
  const sourceRows = cleanSystemBaseline ? [] : (imported.ledger_source || []);
  for (const material of imported.material_master || []) {
    const key = `${normalizedKey(material.material_name)}|${material.unit}`;
    if (!consumption.has(key)) consumption.set(key, { material_name: material.material_name, unit: material.unit, theoretical_qty: 0, source_sales_qty: 0, sku_contributors: [] });
  }
  for (const source of sourceRows.filter((row) => row.store_code === storeCode)) {
    const key = `${normalizedKey(source.material_name)}|${source.unit}`;
    if (!consumption.has(key)) consumption.set(key, { material_name: source.material_name, unit: source.unit, theoretical_qty: 0, source_sales_qty: 0, sku_contributors: [] });
  }
  const mapped = rows.filter((row) => (imported.bom_by_sku?.[row.sku_code] || []).length).length;
  const totalQty = r2Round(rows.reduce((sum, row) => sum + row.sales_qty, 0)), totalAmount = r2Round(rows.reduce((sum, row) => sum + (row.sales_amount || 0), 0));
  const materials = Array.from(consumption.values()).sort((a, b) => b.theoretical_qty - a.theoretical_qty || a.material_name.localeCompare(b.material_name, 'zh-CN'));
  const externalTransferRecords = cleanSystemBaseline ? [] : (imported.transfer_source?.records || []);
  const partyMatchesStore = (party) => {
    const left = normalizedKey(party), right = normalizedKey(storeCode);
    return left === right || left.includes(right) || right.includes(left);
  };
  const externalTransferEvents = externalTransferRecords.flatMap((transfer) => {
    if (transfer.business_date !== latestDate) return [];
    const eventBase = { id: `FS-${transfer.record_id}`, document_no: transfer.document_no, business_date: transfer.business_date, material_name: transfer.material_name, unit: transfer.unit, qty: transfer.qty, created_at: imported.imported_at, status: 'active', source: 'feishu_transfer', feishu_record_id: transfer.record_id };
    const events = [];
    if (partyMatchesStore(transfer.from_party)) events.push({ ...eventBase, type: 'transfer_out', store_code: storeCode, reference: `飞书调拨至 ${transfer.to_party}` });
    if (partyMatchesStore(transfer.to_party)) events.push({ ...eventBase, type: 'transfer_in', store_code: storeCode, reference: `飞书调拨自 ${transfer.from_party}` });
    return events;
  });
  const useExternalTransferSource = !cleanSystemBaseline && Number(imported.transfer_source?.valid_records || 0) > 0;
  const ledger = materials.map((item) => {
    const materialKey = normalizedKey(item.material_name);
    const sameDay = sourceRows.find((row) => row.store_code === storeCode && row.business_date === latestDate && normalizedKey(row.material_name) === materialKey);
    const prior = sourceRows.filter((row) => row.store_code === storeCode && row.business_date < latestDate && normalizedKey(row.material_name) === materialKey && row.source_closing_qty != null).sort((a, b) => b.business_date.localeCompare(a.business_date))[0];
    const baseline = cleanSystemBaseline ? demoDay.opening_by_key?.[`${materialKey}|${item.unit}`] : (imported.opening_by_store?.[storeCode] || imported.opening || {})[`${materialKey}|${item.unit}`];
    const finalizedOpening = cleanSystemBaseline ? null : r2LatestLedgerSnapshot(value, storeCode, latestDate, item.material_name, item.unit);
    const scenario = cleanSystemBaseline || finalizedOpening || demoDay?.opening_initialized_at ? null : (R2_MATERIAL_DIAGNOSIS_SCENARIOS[`${materialKey}|${item.unit}`] || null);
    const openingQty = cleanSystemBaseline ? (baseline ?? 0) : (scenario?.opening_qty ?? finalizedOpening?.theoretical_closing_qty ?? sameDay?.opening_qty ?? prior?.source_closing_qty ?? baseline ?? 0);
    const manualEvents = (value.materialEvents || []).filter((event) => event.status === 'active' && event.store_code === storeCode && event.business_date === latestDate && normalizedKey(event.material_name) === materialKey && event.unit === item.unit);
    const sourceTransferEvents = externalTransferEvents.filter((event) => normalizedKey(event.material_name) === materialKey && event.unit === item.unit);
    const manualQty = (type) => r2Round(manualEvents.filter((event) => event.type === type).reduce((sum, event) => sum + Number(event.qty || 0), 0));
    const sourceQty = (type) => r2Round(sourceTransferEvents.filter((event) => event.type === type).reduce((sum, event) => sum + Number(event.qty || 0), 0));
    const receipt = r2Round((cleanSystemBaseline ? 0 : (sameDay?.receipt_qty || 0)) + manualQty('receipt'));
    const transferIn = r2Round((cleanSystemBaseline ? 0 : (useExternalTransferSource ? sourceQty('transfer_in') : (sameDay?.transfer_in_qty || 0))) + manualQty('transfer_in'));
    const transferOut = r2Round((cleanSystemBaseline ? 0 : (useExternalTransferSource ? sourceQty('transfer_out') : (sameDay?.transfer_out_qty || 0))) + manualQty('transfer_out'));
    const scrap = r2Round((cleanSystemBaseline ? 0 : (sameDay?.scrap_qty || 0)) + manualQty('scrap'));
    const theoretical = r2Round(openingQty + receipt + transferIn - transferOut - scrap - item.theoretical_qty);
    const scrapEvents = manualEvents.filter((event) => event.type === 'scrap');
    const scrapSource = scrapEvents.length ? `门店报损单 / R2 演示 ${scrapEvents.length} 笔` : scrap > 0 ? '飞书库存台账 · 报损量' : '待接入飞书报损通道';
    const baselineSource = cleanSystemBaseline ? `系统有效期初 · ${demoDay.session_no}` : (scenario ? `研判演示基线 · ${scenario.label}` : (demoDay?.opening_initialized_at && baseline != null ? `STORE001 营业日干净期初 · ${demoDay.session_no}` : (finalizedOpening ? `昨日台账期末快照 · ${finalizedOpening.snapshot_no}` : (sameDay?.opening_qty != null ? '飞书当日期初' : (prior ? '飞书最近一期末滚动' : (baseline != null ? 'R2 首日全物料实盘基线' : '待首日盘点'))))));
    const industryProfile = r2MaterialKnowhowProfile(item.material_name, item.unit);
    const safetyPolicy = r2SafetyStockPolicy(value, storeCode, item.material_name, item.unit);
    return { ...item, opening_qty: openingQty, receipt_qty: receipt, transfer_in_qty: transferIn, transfer_out_qty: transferOut, scrap_qty: scrap, scrap_source: scrapSource, bom_consumption_qty: item.theoretical_qty, theoretical_closing_qty: theoretical, source_closing_qty: cleanSystemBaseline ? null : (sameDay?.source_closing_qty ?? null), reconciliation_delta: cleanSystemBaseline || sameDay?.source_closing_qty == null ? null : r2Round(sameDay.source_closing_qty - theoretical), safety_qty: safetyPolicy?.safety_qty ?? scenario?.safety_qty ?? null, safety_policy_source: safetyPolicy?.source || null, diagnosis_scenario: scenario?.label ?? null, manual_events: [...manualEvents, ...sourceTransferEvents], baseline_source: baselineSource, prior_closing_qty: finalizedOpening?.theoretical_closing_qty ?? prior?.source_closing_qty ?? null, prior_closing_source: finalizedOpening ? `昨日固化台账 · ${finalizedOpening.snapshot_no}` : prior ? '飞书历史台账期末' : null, receipt_evidence_status: manualEvents.some((event) => event.type === 'receipt') ? 'r2_event' : (cleanSystemBaseline ? 'no_record' : sameDay?.receipt_qty != null ? 'feishu_record' : 'no_record'), receipt_evidence_note: manualEvents.some((event) => event.type === 'receipt') ? '已找到 R2 收货事件' : (cleanSystemBaseline ? '本营业日未录入系统收货事件' : sameDay?.receipt_qty != null ? '已找到当日收货流水' : '当前未找到收货流水，不能直接判定为未收货'), industry_profile: industryProfile, transfer_source: cleanSystemBaseline ? '系统演示调拨事件' : (useExternalTransferSource ? '飞书调拨单' : '门店库存台账') };
  });
  const materialAnomalies = (value.materialAnomalies || []).filter((item) => item.store_code === storeCode && item.business_date === latestDate && item.status !== 'auto_closed');
  const anomalyByMaterial = new Map(materialAnomalies.map((item) => [`${normalizedKey(item.material_name)}|${item.unit}`, item]));
  const ledgerWithAnomalies = ledger.map((row) => ({ ...row, anomaly: anomalyByMaterial.get(`${normalizedKey(row.material_name)}|${row.unit}`) || null }));
  return { store_code: storeCode, business_date: latestDate, sales_lines: rows.length, sales_qty: totalQty, sales_amount: totalAmount, mapped_sales_records: mapped, unmapped_sales_records: rows.length - mapped, materials, ledger: ledgerWithAnomalies, unmappedSkus: Array.from(unmapped.values()) };
}

function r2ImportedFeishuState(value) {
  const imported = value.feishuImport, latestDate = imported.latest_business_date;
  const storeCodes = Array.from(new Set([
    ...R2_STORE_CODES,
    ...imported.sales.filter((row) => row.business_date === latestDate).map((row) => row.store_code),
    ...(value.materialEvents || []).filter((row) => row.business_date === latestDate).map((row) => row.store_code),
    ...(value.storeTransferRequests || []).filter((row) => row.business_date === latestDate).flatMap((row) => [row.from_store_code, row.to_store_code])
  ].filter(Boolean))).sort();
  const storeViews = storeCodes.map((storeCode) => {
    const view = r2ImportedStoreView(value, storeCode, latestDate);
    return { ...view, ledger: r2AttachLatestPhysicalCounts(value, view.ledger || [], storeCode, latestDate) };
  });
  const primary = storeViews.find((view) => view.store_code === STORE_CODE) || storeViews[0] || { store_code: STORE_CODE, business_date: latestDate, sales_lines: 0, sales_qty: 0, sales_amount: 0, mapped_sales_records: 0, unmapped_sales_records: 0, materials: [], ledger: [], unmappedSkus: [] };
  const totalRecords = storeViews.reduce((sum, view) => sum + view.sales_lines, 0);
  const totalMapped = storeViews.reduce((sum, view) => sum + view.mapped_sales_records, 0);
  const hqSummary = { business_date: latestDate, store_count: storeViews.length, sales_lines: totalRecords, sales_qty: r2Round(storeViews.reduce((sum, view) => sum + view.sales_qty, 0)), sales_amount: r2Round(storeViews.reduce((sum, view) => sum + view.sales_amount, 0)), active_material_anomalies: (value.materialAnomalies || []).filter((item) => item.business_date === latestDate && !['closed', 'auto_closed'].includes(item.status)).length };
  return { source: { name: '飞书销售 → R2 锁定批次；系统物料 / BOM / 期初 → R2', tables: ['门店销售明细（只读）'], syncSchedule: '每 10 分钟读取销售；已初始化的营业日锁定批次' }, latestBatch: { id: imported.id, status: 'completed', started_at: imported.imported_at, completed_at: imported.imported_at, scanned_records: imported.records, imported_records: totalRecords, mapped_sales_records: totalMapped, unmapped_sales_records: totalRecords - totalMapped }, coverage: totalRecords ? Math.round(totalMapped / totalRecords * 100) : 0, mapping: { product_skus: imported.product_skus || 0, bom_skus: Object.keys(imported.bom_by_sku || {}).length, bom_lines: imported.bom_lines || 0, brand_real_skus: R2_REAL_PRODUCT_SKUS.length, mvp_mock_bom_skus: Object.keys(imported.bom_by_sku || {}).filter((sku) => !R2_REAL_PRODUCT_SKU_SET.has(sku)).length }, demo: null, demoBaseline: { counted_date: previousBusinessDate(latestDate), effective_business_date: latestDate, material_count: primary.ledger?.length || 0, source: '系统初始化有效期初（不读取飞书库存）' }, groups: storeViews.map(({ store_code, business_date, sales_lines, sales_qty, sales_amount }) => ({ store_code, business_date, sales_lines, sales_qty, sales_amount })), latestGroup: { store_code: primary.store_code, business_date: primary.business_date, sales_lines: primary.sales_lines, sales_qty: primary.sales_qty, sales_amount: primary.sales_amount }, selectedStore: primary.store_code, storeViews, hqSummary, materials: primary.materials, ledger: primary.ledger, materialEvents: (value.materialEvents || []).filter((event) => event.status === 'active'), materialAnomalies: value.materialAnomalies || [], operationTasks: value.operationTasks || [], documents: value.documents || [], diagnosisCases: value.diagnosisCases || [], diagnosisKnowledge: value.diagnosisKnowledge || [], eventSources: value.feishuEventSources || FEISHU_EVENT_SOURCE_SCHEMA, transfers: { ...(imported.transfer_source || { scanned_records: 0, valid_records: 0, records: [] }), demo_orders: value.transferOrders || [], store_requests: value.storeTransferRequests || [], inventory_archives: value.transferArchives || [] }, ledgerSnapshots: value.ledgerSnapshots || [], unmappedSkus: primary.unmappedSkus, highlight: null, calculation: { formula: '每个门店独立按：系统有效期初 + 系统收货 + 系统调拨入 − 系统调拨出 − 系统报损 − 飞书销售 SKU × 系统 BOM 用量 = 理论期末。', rollover: '本次正式演示不读取飞书库存、收货或调拨；STORE001 的期初由系统重新初始化。', writeback: '飞书销售只读；初始化期初、库存动作、盘点与回算全部写入 R2。' }, storage: value.storage, r2Import: imported, masterDataQuality: r2MasterDataQuality(value) };
}

function r2CountPlanGate(value, view) {
  const missingUnits = (view.ledger || []).filter((row) => !row.unit || /未配置/.test(row.unit));
  const unmapped = view.unmappedSkus || [];
  const missingBomRecords = Math.max(0, Number(view.sales_lines || 0) - Number(view.mapped_sales_records || 0));
  // 未映射 SKU 不能扣减库存，但不应阻止每日盘点计划；将它显式作为数据质量预警。
  const passed = !missingUnits.length;
  const warning = missingBomRecords ? `${missingBomRecords} 条销售未配置本地 BOM，已跳过物料扣减。` : null;
  return { passed, checked_at: now(), store_code: view.store_code, business_date: view.business_date, sales_lines: view.sales_lines || 0, mapped_sales_records: view.mapped_sales_records || 0, material_count: (view.ledger || []).length, missing_unit_materials: missingUnits.map((row) => row.material_name), unmapped_skus: unmapped, skipped_unmapped_sales_records: missingBomRecords, warning, message: passed ? `盘点计划可生成：${view.mapped_sales_records || 0}/${view.sales_lines || 0} 条销售可按本地 BOM 拆解，${(view.ledger || []).length} 项物料单位完整。${warning ? ` ${warning}` : ''}` : `盘点计划已阻止：${missingUnits.length} 项物料缺少有效单位。` };
}

function r2EnsureDailyCountPlans(value, calculated = r2ImportedFeishuState(value), actor = '总部运营自动计划', planDate = chinaBusinessDate()) {
  const created = [], refreshed = [], blocked = [];
  const currentViews = (calculated.storeViews || []).filter((view) => view.business_date === planDate);
  const fallbackSnapshots = new Map();
  if (!currentViews.length) {
    for (const snapshot of value.ledgerSnapshots || []) {
      if (snapshot.business_date >= planDate || fallbackSnapshots.has(snapshot.store_code)) continue;
      fallbackSnapshots.set(snapshot.store_code, snapshot);
    }
  }
  const plannedViews = currentViews.length ? currentViews : Array.from(fallbackSnapshots.values()).map((snapshot) => ({
    store_code: snapshot.store_code, business_date: planDate,
    ledger: (snapshot.lines || []).map((line) => ({ ...line, theoretical_closing_qty: line.theoretical_closing_qty, safety_qty: null }))
  }));
  for (const view of plannedViews) {
    const businessDate = planDate;
    if (!businessDate || !view.ledger?.length) continue;
    // 耗材仍进入库存回算，但不进入每日盘点范围。
    const dailyLedger = view.ledger.filter((row) => r2DailyCountEnabled(value, row.material_name));
    const gate = r2CountPlanGate(value, { ...view, ledger: dailyLedger });
    value.countPlanGateResults = [gate, ...(value.countPlanGateResults || []).filter((item) => !(item.store_code === view.store_code && item.business_date === businessDate))].slice(0, 50);
    if (!gate.passed) { blocked.push(gate); r2Audit(value, actor, 'BOM 完整度门禁阻止盘点计划', `${view.store_code} · ${businessDate} · ${gate.message}`, `${view.store_code}-${businessDate}`); continue; }
    const existing = value.countPlans.find((plan) => plan.store_code === view.store_code && plan.business_date === businessDate && (!plan.plan_type || plan.plan_type === 'daily_full'));
    const planNo = `PD-${businessDate.replaceAll('-', '')}-${view.store_code}`;
    const lines = dailyLedger.map((row) => ({
      material_name: row.material_name, unit: row.unit, theoretical_qty: row.theoretical_closing_qty,
      safety_qty: row.safety_qty ?? null, source: currentViews.length ? '计划生成时理论库存快照' : '最近已固化日结期末快照（今日尚未同步销售）'
    }));
    if (existing) {
      if (existing.status === 'pending_store_count' && !existing.document_id) {
        existing.lines = lines; existing.material_count = lines.length; existing.source_batch_id = value.feishuImport?.id || null; existing.theoretical_snapshot_at = now(); existing.snapshot_event_count = (value.materialEvents || []).filter((event) => event.store_code === view.store_code && event.business_date === businessDate && event.status === 'active').length; existing.bom_gate = gate; existing.snapshot_revision = Number(existing.snapshot_revision || 1) + 1;
        refreshed.push(existing); r2Audit(value, actor, '盘点前刷新理论库存快照', `${existing.plan_no} · 已刷新为 ${lines.length} 项每日盘点物料，纳入 ${existing.snapshot_event_count} 笔当日库存动作。`, existing.id);
      }
      continue;
    }
    const plan = { id: planNo, plan_no: planNo, plan_type: 'daily_full', store_code: view.store_code, business_date: businessDate, status: 'pending_store_count', created_at: now(), generated_by: actor, source_batch_id: value.feishuImport?.id || null, material_count: lines.length, lines, submitted_material_count: 0, theoretical_snapshot_at: now(), snapshot_revision: 1, snapshot_event_count: (value.materialEvents || []).filter((event) => event.store_code === view.store_code && event.business_date === businessDate && event.status === 'active').length, bom_gate: gate };
    value.countPlans.unshift(plan); created.push(plan);
    r2Audit(value, actor, '生成每日物料盘点计划', `${planNo} · ${view.store_code} · 按物料盘点策略纳入 ${lines.length} 项每日盘点物料。`, plan.id);
  }
  return { created, refreshed, blocked };
}

async function r2GenerateDailyCountPlans(env) {
  const value = await r2DemoState(env);
  if (!value.feishuImport?.sales?.length && !value.ledgerSnapshots?.length) return bad('请先完成一次飞书销售同步或日结快照，才能生成每日物料盘点计划。', 409);
  const calculated = value.feishuImport?.sales?.length ? r2ImportedFeishuState(value) : { storeViews: [] };
  const result = r2EnsureDailyCountPlans(value, calculated, '总部运营手动生成', chinaBusinessDate());
  const state = await r2SaveDemoState(env, value, result.created.length ? 'count-plan-generate' : result.refreshed.length ? 'count-plan-refresh' : result.blocked.length ? 'count-plan-blocked' : 'count-plan-exists');
  return json({ ...r2StateView(state, 'count-plans'), generated_count: result.created.length, refreshed_count: result.refreshed.length, blocked: result.blocked });
}

function r2DiagnosisReview(value, caseItem) {
  const signals = (value.materialAnomalies || []).filter((item) => (caseItem.signal_ids || []).includes(item.id));
  const materialNames = (rows) => Array.from(new Set(rows.map((item) => item.material_name).filter(Boolean)));
  const priorNegative = signals.filter((item) => item.evidence_detail?.prior_negative_sales || Number(item.evidence_detail?.prior_closing_qty) < 0);
  const priorKnown = signals.filter((item) => item.evidence_detail?.prior_closing_qty != null);
  const receiptMissing = signals.filter((item) => item.evidence_detail?.receipt_status === 'no_record');
  const bomMissing = signals.filter((item) => (item.industry_assessment?.checks || []).some((check) => check.code === 'bom_coverage' && check.status === 'suspected'));
  const unitKnown = signals.filter((item) => item.unit && !/未配置/.test(item.unit));
  const unitConversionMissing = signals.filter((item) => (item.industry_assessment?.checks || []).some((check) => check.code === 'unit_conversion' && check.status === 'insufficient'));
  const counted = signals.filter((item) => item.evidence_detail?.physical_qty != null);
  const remainingVariances = (caseItem.last_count_result?.variances || []).filter((line) => line.exceeded);
  const openEvidenceTask = (value.operationTasks || []).find((task) => task.source_case_id === caseItem.id && task.task_type === 'receipt_evidence' && task.status !== 'closed');
  const openGovernanceTask = (value.governanceTasks || []).find((task) => task.source_case_id === caseItem.id && task.status !== 'closed');
  const checks = [
    { code: 'prior_cycle', label: '上一营业日期末', status: priorNegative.length ? 'abnormal' : priorKnown.length === signals.length && signals.length ? 'passed' : 'insufficient', summary: priorNegative.length ? `${priorNegative.length} 项上期已经为负，属于跨期遗留信号。` : priorKnown.length === signals.length && signals.length ? `${priorKnown.length} 项均找到上期期末，未发现负数。` : `已找到 ${priorKnown.length}/${signals.length} 项上期期末，其余证据不足。`, material_names: materialNames(priorNegative) },
    { code: 'receipt', label: '收货与调拨入库', status: receiptMissing.length ? 'insufficient' : signals.length ? 'passed' : 'insufficient', summary: receiptMissing.length ? `${receiptMissing.length} 项未找到对应收货或调拨入库记录，当前只能标记证据不足。` : `${signals.length} 项均找到可追溯的入库证据。`, material_names: materialNames(receiptMissing) },
    { code: 'unit', label: '库存单位与换算', status: unitConversionMissing.length ? 'insufficient' : unitKnown.length === signals.length && signals.length ? 'passed' : 'abnormal', summary: unitConversionMissing.length ? `${unitKnown.length} 项库存单位已识别；${unitConversionMissing.length} 项采购包装与盘点换算尚未配置。` : `${unitKnown.length} 项库存单位与换算配置可用。`, material_names: materialNames(unitConversionMissing) },
    { code: 'bom', label: '销售 SKU 与 BOM', status: bomMissing.length ? 'abnormal' : signals.length ? 'passed' : 'insufficient', summary: bomMissing.length ? `${bomMissing.length} 项缺少可追溯的销售 SKU BOM 明细。` : `${signals.length} 项均能追溯到销售 SKU 与 BOM。`, material_names: materialNames(bomMissing) },
    { code: 'physical_count', label: '最近一次门店盘点', status: remainingVariances.length ? 'abnormal' : counted.length ? 'passed' : 'insufficient', summary: remainingVariances.length ? `最近盘点仍有 ${remainingVariances.length} 项超过容差，需要继续沿用本工单复盘。` : counted.length ? `${counted.length} 项已有实盘记录，当前未发现剩余超差。` : '尚无可用于排除的门店实盘，盘点作为前置证据排除后的兜底动作。', material_names: remainingVariances.map((line) => line.material_name) }
  ];
  let nextAction;
  if (['awaiting_store_count', 'targeted_count_dispatched', 'pending_verification'].includes(caseItem.status)) {
    const planNo = caseItem.targeted_count_plan_no || caseItem.dispatched_count_plan_no || null;
    nextAction = { type: 'wait', label: statusTextForAudit(caseItem.status), description: planNo ? `盘点单 ${planNo} 已下发；门店提交后系统会自动回到原工单继续判断。` : '当前动作已经下发，等待责任人提交后系统会自动推进本工单。', status: 'dispatched', plan_no: planNo };
  } else if (openGovernanceTask) {
    nextAction = { type: 'wait', label: '等待总部完成主数据修正', description: `工单 ${openGovernanceTask.id} 正在处理；完成后重新回算受影响物料。`, status: 'dispatched', task_id: openGovernanceTask.id };
  } else if (bomMissing.length || unitConversionMissing.length) {
    const affected = materialNames([...bomMissing, ...unitConversionMissing]);
    nextAction = { type: 'create_governance_task', label: `创建 ${affected.length} 项主数据修正工单`, description: '销售 SKU 与 BOM 已存在可确认异常。先交由总部商品/数据人员修正 BOM、库存单位与包装换算；收货凭证等证据不足项保留为后续核对，不先下发门店任务。', material_names: affected };
  } else if (openEvidenceTask) {
    nextAction = { type: 'wait', label: '等待门店补充收货凭证', description: `任务 ${openEvidenceTask.id} 已下发；门店提交并经总部验收后，系统继续沿用本工单重新核对。`, status: 'dispatched', task_id: openEvidenceTask.id };
  } else if (receiptMissing.length) {
    nextAction = { type: 'request_receipt_evidence', label: `向门店索取 ${receiptMissing.length} 项收货凭证`, description: '生成一张门店补充凭证任务；收到凭证后再重新回算，不直接认定门店漏收货。', material_names: materialNames(receiptMissing) };
  } else if (caseItem.status === 'needs_hq_action' && remainingVariances.length === 1) {
    const line = remainingVariances[0];
    nextAction = { type: 'dispatch_targeted_count', label: `再次盘点${line.material_name}`, description: `前置证据均已排除；生成仅包含${line.material_name}的定向盘点单，门店提交后继续回到工单 ${caseItem.case_no} 验证。`, material_name: line.material_name, unit: line.unit };
  } else if (caseItem.status === 'needs_hq_action' && remainingVariances.length > 1) {
    nextAction = { type: 'dispatch_remaining_count', label: `再次盘点剩余 ${remainingVariances.length} 项`, description: `前置证据均已排除；按上次盘点的超差结果生成复盘单，不重复盘点已正常物料，并继续沿用工单 ${caseItem.case_no}。`, material_count: remainingVariances.length };
  } else if (['open', 'pending_hq_governance'].includes(caseItem.status)) {
    nextAction = { type: 'dispatch_count', label: `生成 ${signals.length} 项异常物料盘点单`, description: '前置数据检查未发现可解释原因，盘点作为最后的强校正手段。', material_count: signals.length };
  } else if (caseItem.status === 'pending_hq_close') {
    nextAction = { type: 'close_case', label: '确认处理并结案', description: '当前回算已恢复正常，确认后关闭工单并保留完整处理记录。' };
  } else {
    nextAction = { type: 'wait', label: statusTextForAudit(caseItem.status), description: '当前动作已经下发，等待责任人提交后系统会自动推进本工单。' };
  }
  return { checked_at: now(), signal_ids: caseItem.signal_ids || [], checks, next_action: nextAction, summary: `已自动完成 5 类证据核对：${checks.filter((item) => item.status === 'passed').length} 项通过、${checks.filter((item) => item.status === 'abnormal').length} 项异常、${checks.filter((item) => item.status === 'insufficient').length} 项证据不足。` };
}

function statusTextForAudit(status) {
  return ({ awaiting_store_count: '等待门店提交盘点', targeted_count_dispatched: '等待门店提交定向盘点', pending_verification: '等待下一次回算验证' })[status] || '等待当前动作完成';
}

async function r2RunDiagnosisAutoReview(env, caseId) {
  const value = await r2DemoState(env);
  const caseItem = (value.diagnosisCases || []).find((item) => item.id === caseId);
  if (!caseItem) return bad('日结研判单不存在。', 404);
  if (caseItem.case_type !== 'store_daily') return bad('当前自动核对仅适用于门店日结研判单。', 409);
  caseItem.guide_review = r2DiagnosisReview(value, caseItem);
  caseItem.updated_at = caseItem.guide_review.checked_at;
  r2Audit(value, '研判处理向导', '自动完成前置证据核对', `${caseItem.case_no} · ${caseItem.guide_review.summary} 下一步：${caseItem.guide_review.next_action.label}。`, caseItem.id);
  return json({ case: caseItem, review: caseItem.guide_review, state: await r2SaveDemoState(env, value, 'diagnosis-auto-review') });
}

async function r2CreateDiagnosisFollowup(env, caseId, type) {
  const value = await r2DemoState(env);
  const caseItem = (value.diagnosisCases || []).find((item) => item.id === caseId);
  if (!caseItem) return bad('日结研判单不存在。', 404);
  const review = r2DiagnosisReview(value, caseItem);
  if (review.next_action.type !== type) return bad(`当前最佳动作已变更为“${review.next_action.label}”，请刷新后继续。`, 409);
  const createdAt = now();
  if (type === 'request_receipt_evidence') {
    const existing = (value.operationTasks || []).find((task) => task.source_case_id === caseItem.id && task.task_type === 'receipt_evidence' && task.status !== 'closed');
    if (existing) return json({ case: caseItem, task: existing, state: value });
    const names = review.next_action.material_names || [];
    const task = { id: id('OPT'), store_code: caseItem.store_code, task_type: 'receipt_evidence', title: `补充 ${names.length} 项收货凭证`, instruction: `请补充以下物料的收货单号、到货时间或入库照片：${names.join('、')}。提交后系统将继续沿用研判工单 ${caseItem.case_no} 重新核对。`, material_names: names, status: 'pending_store_submission', assigned_to: `${caseItem.store_code} 店长`, created_at: createdAt, source_case_id: caseItem.id, source_case_no: caseItem.case_no };
    value.operationTasks.unshift(task); value.operationTask = task; review.next_action.status = 'dispatched'; review.next_action.task_id = task.id; caseItem.guide_review = review; caseItem.updated_at = createdAt;
    r2Audit(value, '研判处理向导', '向门店索取收货凭证', `${caseItem.case_no} · 已生成 ${task.id}，涉及 ${names.length} 项物料。`, caseItem.id);
    return json({ case: caseItem, task, state: await r2SaveDemoState(env, value, 'diagnosis-request-evidence') }, 201);
  }
  const existing = (value.governanceTasks || []).find((task) => task.source_case_id === caseItem.id && task.status !== 'closed');
  if (existing) return json({ case: caseItem, task: existing, state: value });
  const names = review.next_action.material_names || [];
  const task = { id: id('GOV'), source_case_id: caseItem.id, source_case_no: caseItem.case_no, title: `${names.length} 项物料主数据修正`, instruction: `核对 ${names.join('、')} 的销售 SKU、BOM、库存单位和包装换算，完成后重新运行门店台账回算。`, owner: '总部商品 / 数据治理', status: 'pending', created_at: createdAt };
  value.governanceTasks.unshift(task); review.next_action.status = 'dispatched'; review.next_action.task_id = task.id; caseItem.guide_review = review; caseItem.updated_at = createdAt;
  r2Audit(value, '研判处理向导', '创建总部主数据治理工单', `${caseItem.case_no} · 已生成 ${task.id}，涉及 ${names.length} 项物料。`, caseItem.id);
  return json({ case: caseItem, task, state: await r2SaveDemoState(env, value, 'diagnosis-create-governance') }, 201);
}

async function r2DispatchDiagnosisCount(env, caseId) {
  const value = await r2DemoState(env);
  const caseItem = (value.diagnosisCases || []).find((item) => item.id === caseId);
  if (!caseItem) return bad('日结研判单不存在。', 404);
  if (caseItem.status === 'closed') return bad('已结案的研判单不能再次下发盘点。', 409);
  if (caseItem.case_type !== 'store_daily') return bad('跨门店物料研判请先完成总部配置核验，再按门店生成定向盘点。', 409);
  if (!value.feishuImport?.sales?.length) return bad('请先完成销售同步，才能依据台账生成盘点单。', 409);
  const calculated = r2ImportedFeishuState(value);
  const businessDate = caseItem.latest_business_date || chinaBusinessDate();
  const priorPlan = (value.countPlans || []).find((item) => item.parent_case_id === caseItem.id && item.plan_type === 'diagnosis_risk');
  if (priorPlan && priorPlan.status !== 'pending_store_count') return bad(`本工单的异常物料盘点 ${priorPlan.plan_no} 已生成并提交；如仍有差异，请继续下发定向盘点。`, 409);
  const view = (calculated.storeViews || []).find((item) => item.store_code === caseItem.store_code);
  if (!view?.ledger?.length) return bad('当前无法读取该门店的物料台账，不能生成盘点计划。', 409);
  const signals = (value.materialAnomalies || []).filter((item) => (caseItem.signal_ids || []).includes(item.id));
  // 盘点后新增的 COUNT_VARIANCE 走后续定向复盘，不混入首次“基础异常物料”盘点。
  const baseSignals = signals.filter((item) => item.rule_code !== 'COUNT_VARIANCE');
  const riskSignals = baseSignals.length ? baseSignals : signals;
  const signalKeys = new Set(riskSignals.map((item) => `${normalizedKey(item.material_name)}|${item.unit}`));
  const riskRows = (view.ledger || []).filter((row) => signalKeys.has(`${normalizedKey(row.material_name)}|${row.unit}`));
  if (!riskRows.length) return bad('当前研判单没有可下发的异常物料，请先刷新研判结果。', 409);
  const baseNo = `PD-${businessDate.replaceAll('-', '')}-${caseItem.store_code}-RISK${riskRows.length}-${String(caseItem.case_no || caseItem.id).split('-').pop()}`;
  const lines = riskRows.map((row) => ({
    material_name: row.material_name, unit: row.unit, theoretical_qty: row.theoretical_closing_qty,
    safety_qty: row.safety_qty ?? null, source: `研判单 ${caseItem.case_no} 下发时理论库存快照`
  }));
  let plan = priorPlan;
  if (plan) {
    const previousNo = plan.plan_no;
    plan.id = baseNo; plan.plan_no = baseNo; plan.material_count = lines.length; plan.target_material_names = lines.map((line) => line.material_name); plan.lines = lines;
    if (previousNo !== baseNo) r2Audit(value, '规则引擎', '校正异常物料盘点范围', `${previousNo} 已在门店执行前校正为 ${baseNo}，排除后续盘点产生的差异信号，仅保留 ${lines.length} 项基础异常物料。`, caseItem.id);
  } else {
    const planNo = (value.countPlans || []).some((item) => item.plan_no === baseNo) ? `${baseNo}-${Date.now().toString(36).slice(-4).toUpperCase()}` : baseNo;
    plan = { id: planNo, plan_no: planNo, plan_type: 'diagnosis_risk', parent_case_id: caseItem.id, parent_case_no: caseItem.case_no, store_code: caseItem.store_code, business_date: businessDate, status: 'pending_store_count', created_at: now(), generated_by: '日结研判中心异常物料下发', source_batch_id: value.feishuImport?.id || null, material_count: lines.length, target_material_names: lines.map((line) => line.material_name), lines, submitted_material_count: 0 };
    value.countPlans.unshift(plan);
  }
  caseItem.status = 'awaiting_store_count'; caseItem.dispatched_count_plan_no = plan.plan_no; caseItem.updated_at = now();
  caseItem.recommended_actions = (caseItem.recommended_actions || []).map((item) => item.type === 'full_inventory_count' ? { ...item, status: 'dispatched', plan_no: plan.plan_no } : item);
  caseItem.guide_review = r2DiagnosisReview(value, caseItem);
  r2Audit(value, '日结研判中心', '下发异常物料盘点', `${caseItem.case_no} · 已生成 ${plan.material_count} 项异常物料盘点计划 ${plan.plan_no}，等待 ${caseItem.store_code} 提交实盘。`, caseItem.id);
  return json({ case: caseItem, plan, state: await r2SaveDemoState(env, value, 'diagnosis-dispatch-count') });
}

async function r2DispatchTargetedDiagnosisCount(env, caseId, body = {}) {
  const value = await r2DemoState(env);
  const caseItem = (value.diagnosisCases || []).find((item) => item.id === caseId);
  if (!caseItem) return bad('日结研判单不存在。', 404);
  if (caseItem.status === 'closed') return bad('已结案的研判单不能再次下发盘点。', 409);
  if (caseItem.case_type !== 'store_daily') return bad('当前仅支持门店日结研判单下发定向盘点。', 409);
  const materialName = String(body.material_name || body.materialName || '').trim();
  const unit = String(body.unit || '').trim();
  if (!materialName || !unit) return bad('请选择需要定向复盘的物料和单位。');
  const calculated = r2ImportedFeishuState(value);
  const view = (calculated.storeViews || []).find((item) => item.store_code === caseItem.store_code);
  const row = (view?.ledger || []).find((item) => normalizedKey(item.material_name) === normalizedKey(materialName) && item.unit === unit);
  if (!row) return bad('当前回算中找不到该门店物料。', 409);
  const existing = (value.countPlans || []).find((plan) => plan.parent_case_id === caseItem.id && plan.target_material_name === row.material_name && plan.status === 'pending_store_count');
  if (existing) return json({ case: caseItem, plan: existing, state: value });
  const planNo = `PD-${caseItem.latest_business_date.replaceAll('-', '')}-${caseItem.store_code}-${normalizedKey(row.material_name).replace(/[^A-Z0-9]+/gi, '').slice(0, 8).toUpperCase() || 'MAT'}`;
  const plan = { id: planNo, plan_no: planNo, plan_type: 'targeted_material', parent_case_id: caseItem.id, parent_case_no: caseItem.case_no, target_material_name: row.material_name, store_code: caseItem.store_code, business_date: caseItem.latest_business_date, status: 'pending_store_count', created_at: now(), generated_by: '日结研判中心定向复盘', source_batch_id: value.feishuImport?.id || null, material_count: 1, lines: [{ material_name: row.material_name, unit: row.unit, theoretical_qty: row.theoretical_closing_qty, safety_qty: row.safety_qty ?? null, source: '日结研判单定向复盘快照' }], submitted_material_count: 0 };
  value.countPlans.unshift(plan);
  caseItem.status = 'targeted_count_dispatched'; caseItem.updated_at = plan.created_at; caseItem.targeted_count_plan_no = plan.plan_no; caseItem.targeted_material_name = row.material_name;
  caseItem.recommended_actions = (caseItem.recommended_actions || []).map((item) => item.type === 'targeted_count' ? { ...item, status: 'dispatched', plan_no: plan.plan_no, material_name: row.material_name } : item);
  caseItem.guide_review = r2DiagnosisReview(value, caseItem);
  r2Audit(value, '日结研判中心', '下发定向物料盘点', `${caseItem.case_no} · ${row.material_name} · 已关联盘点计划 ${plan.plan_no}，沿用原研判单持续跟踪。`, caseItem.id);
  return json({ case: caseItem, plan, state: await r2SaveDemoState(env, value, 'diagnosis-dispatch-targeted-count') }, 201);
}

async function r2DispatchRemainingDiagnosisCount(env, caseId) {
  const value = await r2DemoState(env);
  const caseItem = (value.diagnosisCases || []).find((item) => item.id === caseId);
  if (!caseItem) return bad('日结研判单不存在。', 404);
  if (caseItem.status !== 'needs_hq_action') return bad('当前工单没有等待再次盘点的剩余差异。', 409);
  const remaining = (caseItem.last_count_result?.variances || []).filter((line) => line.exceeded);
  if (remaining.length < 2) return bad('剩余一项差异时请使用定向盘点。', 409);
  const calculated = r2ImportedFeishuState(value);
  const view = (calculated.storeViews || []).find((item) => item.store_code === caseItem.store_code);
  const rows = remaining.map((variance) => (view?.ledger || []).find((row) => normalizedKey(row.material_name) === normalizedKey(variance.material_name) && row.unit === variance.unit)).filter(Boolean);
  if (rows.length !== remaining.length) return bad('部分剩余差异物料已不在当前台账中，请重新运行自动核对。', 409);
  const existing = (value.countPlans || []).find((plan) => plan.parent_case_id === caseItem.id && plan.plan_type === 'targeted_material_set' && plan.status === 'pending_store_count');
  if (existing) return json({ case: caseItem, plan: existing, state: value });
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  const planNo = `PD-${caseItem.latest_business_date.replaceAll('-', '')}-${caseItem.store_code}-RECHECK${rows.length}-${suffix}`;
  const plan = { id: planNo, plan_no: planNo, plan_type: 'targeted_material_set', parent_case_id: caseItem.id, parent_case_no: caseItem.case_no, store_code: caseItem.store_code, business_date: caseItem.latest_business_date, status: 'pending_store_count', created_at: now(), generated_by: '研判处理向导剩余差异复盘', source_batch_id: value.feishuImport?.id || null, material_count: rows.length, target_material_names: rows.map((row) => row.material_name), lines: rows.map((row) => ({ material_name: row.material_name, unit: row.unit, theoretical_qty: row.theoretical_closing_qty, safety_qty: row.safety_qty ?? null, source: `研判单 ${caseItem.case_no} 上次盘点剩余差异` })), submitted_material_count: 0 };
  value.countPlans.unshift(plan);
  caseItem.status = 'targeted_count_dispatched'; caseItem.updated_at = plan.created_at; caseItem.targeted_count_plan_no = plan.plan_no;
  caseItem.guide_review = { ...r2DiagnosisReview(value, { ...caseItem, status: 'needs_hq_action' }), next_action: { type: 'wait', label: '等待门店提交剩余差异复盘', description: `复盘单 ${plan.plan_no} 已下发，门店提交后继续回到原工单验证。`, status: 'dispatched', plan_no: plan.plan_no } };
  r2Audit(value, '研判处理向导', '下发剩余差异复盘', `${caseItem.case_no} · 已生成 ${rows.length} 项复盘计划 ${plan.plan_no}，不重复盘点已正常物料。`, caseItem.id);
  return json({ case: caseItem, plan, state: await r2SaveDemoState(env, value, 'diagnosis-dispatch-remaining-count') }, 201);
}

async function r2CloseDiagnosisCase(env, caseId, body = {}) {
  const value = await r2DemoState(env);
  const caseItem = (value.diagnosisCases || []).find((item) => item.id === caseId);
  if (!caseItem) return bad('日结研判单不存在。', 404);
  if (caseItem.status === 'closed') return bad('该研判单已经结案。', 409);
  if (!['pending_hq_close', 'hq_intervention_done'].includes(caseItem.status)) return bad('当前研判仍有未完成的排除或盘点动作，不能直接结案。请先完成动作并等待下一次日结回算验证。', 409);
  const resolution = String(body.resolution || '已完成处理，后续日结将重新校验。').trim().slice(0, 200);
  caseItem.status = 'closed'; caseItem.closed_at = now(); caseItem.updated_at = caseItem.closed_at; caseItem.resolution = resolution;
  r2Audit(value, '总部运营', '关闭日结研判单', `${caseItem.case_no} · ${resolution}`, caseItem.id);
  return json({ case: caseItem, state: await r2SaveDemoState(env, value, 'diagnosis-close') });
}

async function r2ForceCloseDiagnosisCase(env, caseId, body = {}) {
  const value = await r2DemoState(env);
  const caseItem = (value.diagnosisCases || []).find((item) => item.id === caseId);
  if (!caseItem) return bad('日结研判单不存在。', 404);
  if (caseItem.status === 'closed') return bad('该研判单已经结案。', 409);
  const attributionCode = String(body.attribution_code || '').trim();
  if (!R2_DIAGNOSIS_ATTRIBUTIONS[attributionCode]) return bad('请选择有效的人工归因。');
  const customAttribution = String(body.custom_attribution || '').trim().slice(0, 80);
  if (attributionCode === 'other' && customAttribution.length < 2) return bad('选择“其他人工归因”时，请填写具体归因。');
  const reason = String(body.reason || '').trim().slice(0, 400);
  const resolutionMethod = String(body.resolution_method || '').trim().slice(0, 400);
  if (reason.length < 4) return bad('请填写能够解释本次判断的归因依据。');
  if (resolutionMethod.length < 4) return bad('请填写本次实际采用的解决方法。');
  const actor = String(body.actor || '总部运营').trim().slice(0, 40) || '总部运营';
  const closedAt = now();
  const signals = (value.materialAnomalies || []).filter((item) => (caseItem.signal_ids || []).includes(item.id));
  const materials = Array.from(new Set(signals.map((item) => item.material_name).filter(Boolean)));
  const ruleCodes = Array.from(new Set(signals.map((item) => item.rule_code).filter(Boolean)));
  const profileCodes = Array.from(new Set(signals.map((item) => item.industry_assessment?.profile?.code).filter(Boolean)));
  const attributionLabel = attributionCode === 'other' ? customAttribution : R2_DIAGNOSIS_ATTRIBUTIONS[attributionCode];
  const knowledge = {
    id: id('KNW'), source_case_id: caseItem.id, source_case_no: caseItem.case_no,
    store_code: caseItem.store_code || null, case_type: caseItem.case_type, scope: caseItem.scope,
    opened_business_date: caseItem.opened_business_date, latest_business_date: caseItem.latest_business_date,
    root_cause_code: attributionCode, root_cause_label: attributionLabel, custom_attribution: customAttribution || null,
    reason, resolution_method: resolutionMethod, materials, rule_codes: ruleCodes, profile_codes: profileCodes,
    signal_snapshot: signals.map((item) => ({ material_name: item.material_name, unit: item.unit, rule_code: item.rule_code, theoretical_closing_qty: item.theoretical_closing_qty, evidence: item.evidence, industry_conclusion: item.industry_assessment?.conclusion || null })),
    reuse_summary: `历史案例 ${caseItem.case_no}：归因“${attributionLabel}”；解决方法：${resolutionMethod}`,
    closed_by: actor, closed_at: closedAt, created_at: closedAt
  };
  value.diagnosisKnowledge.unshift(knowledge);
  if (caseItem.case_type === 'store_daily') for (const signal of signals) {
    signal.status = 'closed'; signal.closed_at = closedAt; signal.updated_at = closedAt;
    signal.closure_reason = `随研判单 ${caseItem.case_no} 由总部人工强制结案；归因：${attributionLabel}。`;
    signal.closure_knowledge_id = knowledge.id;
  }
  caseItem.status = 'closed'; caseItem.closed_at = closedAt; caseItem.updated_at = closedAt;
  caseItem.closure_mode = 'hq_forced'; caseItem.closure_knowledge_id = knowledge.id;
  caseItem.resolution = `人工归因：${attributionLabel}。判断依据：${reason}。解决方法：${resolutionMethod}`;
  caseItem.closure = { mode: 'hq_forced', attribution_code: attributionCode, attribution_label: attributionLabel, reason, resolution_method: resolutionMethod, actor, closed_at: closedAt, knowledge_id: knowledge.id };
  r2Audit(value, actor, '强制关闭日结研判单并沉淀知识', `${caseItem.case_no} · 归因：${attributionLabel} · 解决方法：${resolutionMethod} · 知识编号：${knowledge.id}`, caseItem.id);
  return json({ case: caseItem, knowledge, state: await r2SaveDemoState(env, value, 'diagnosis-force-close') });
}

function r2MarkCountPlanSubmission(value, storeCode, document, planNo = '') {
  const plan = value.countPlans.find((item) => item.store_code === storeCode && item.status === 'pending_store_count' && (!planNo || item.plan_no === planNo));
  if (!plan) return null;
  const covered = new Set((document.lines || []).map((line) => `${normalizedKey(line.material_name)}|${line.unit}`));
  plan.submitted_material_count = covered.size; plan.document_id = document.id; plan.last_submitted_at = document.received_at;
  plan.status = covered.size >= plan.material_count ? 'pending_hq_review' : 'pending_store_count';
  plan.submission_note = covered.size >= plan.material_count ? `已提交全量 ${covered.size}/${plan.material_count} 项，等待总部复核。` : `已提交 ${covered.size}/${plan.material_count} 项，仍需补齐未盘物料。`;
  const diagnosisCase = (value.diagnosisCases || []).find((item) => item.id === plan.parent_case_id || (item.store_code === storeCode && item.dispatched_count_plan_no === plan.plan_no))
    || (value.diagnosisCases || []).find((item) => item.case_type === 'store_daily' && item.store_code === storeCode && item.latest_business_date === plan.business_date && item.status !== 'closed');
  if (diagnosisCase && covered.size >= plan.material_count) {
    if (!plan.parent_case_id) { plan.parent_case_id = diagnosisCase.id; plan.parent_case_no = diagnosisCase.case_no; }
    const actualByKey = new Map((document.lines || []).map((line) => [`${normalizedKey(line.material_name)}|${line.unit}`, Number(line.actual_qty)]));
    const variances = (plan.lines || []).map((line) => {
      const actual = actualByKey.get(`${normalizedKey(line.material_name)}|${line.unit}`);
      const delta = actual == null ? null : r2Round(actual - Number(line.theoretical_qty || 0));
      const threshold = r2VarianceThreshold({ unit: line.unit, theoretical_closing_qty: Number(line.theoretical_qty || 0) });
      return { material_name: line.material_name, unit: line.unit, theoretical_qty: Number(line.theoretical_qty || 0), actual_qty: actual, delta, threshold, exceeded: delta != null && Math.abs(delta) > threshold };
    }).filter((line) => line.exceeded);
    const remaining = variances.map((line) => `${line.material_name}（${line.unit}）`);
    const observation = { business_date: plan.business_date, observed_at: document.received_at, kind: String(plan.plan_type || '').startsWith('targeted_material') ? 'targeted_count_result' : 'full_count_result', signal_ids: [], signal_count: remaining.length, summary: remaining.length ? `盘点后仍有 ${remaining.length} 项差异：${remaining.join('、')}；继续沿用原研判单。` : `盘点结果与理论库存均在阈值内：${plan.material_count} 项已完成复核。`, count_document_id: document.id, count_plan_no: plan.plan_no, remaining_materials: remaining, variances };
    diagnosisCase.observations = [observation, ...(diagnosisCase.observations || [])];
    diagnosisCase.updated_at = document.received_at; diagnosisCase.latest_count_document_id = document.id; diagnosisCase.last_count_result = observation;
    if (remaining.length) {
      diagnosisCase.status = 'needs_hq_action';
      diagnosisCase.recommended_actions = (diagnosisCase.recommended_actions || []).filter((item) => item.type !== 'targeted_count').concat([{ type: 'targeted_count', label: remaining.length === 1 ? `下发 ${remaining[0]} 定向盘点` : `对剩余 ${remaining.length} 项差异物料定向盘点`, owner: `${storeCode} 店长`, status: 'recommended', material_name: remaining.length === 1 ? variances[0].material_name : null, unit: remaining.length === 1 ? variances[0].unit : null }]);
      r2Audit(value, '规则引擎', '盘点后仍有差异', `${diagnosisCase.case_no} · ${observation.summary}`, diagnosisCase.id);
    } else {
      diagnosisCase.status = 'pending_hq_close';
      diagnosisCase.recommended_actions = (diagnosisCase.recommended_actions || []).map((item) => item.type === 'targeted_count' || item.type === 'full_inventory_count' ? { ...item, status: 'completed' } : item);
      r2Audit(value, '规则引擎', '盘点复核通过', `${diagnosisCase.case_no} · ${observation.summary}，等待总部结案。`, diagnosisCase.id);
    }
    diagnosisCase.guide_review = r2DiagnosisReview(value, diagnosisCase);
  }
  r2Audit(value, '门店', '提交每日盘点计划凭证', `${plan.plan_no} · ${plan.submission_note}`, plan.id);
  return plan;
}

async function demoOpeningCountStatements(db, runId, businessDate, createdAt) {
  const sourceMaterials = await db.prepare(`
    SELECT material_name, unit FROM feishu_bom_lines
    UNION
    SELECT material_name, unit FROM feishu_inventory_source_daily WHERE store_code = ?
    UNION
    SELECT material_name, unit FROM feishu_material_consumption_daily WHERE store_code = ?
  `).bind(STORE_CODE, STORE_CODE).all();
  const materials = new Map();
  for (const row of sourceMaterials.results) {
    if (row.material_name && row.unit) materials.set(`${normalizedKey(row.material_name)}|${row.unit}`, row);
  }
  const countedDate = previousBusinessDate(businessDate);
  return Array.from(materials.values()).map((row) =>
    db.prepare(`INSERT INTO demo_opening_inventory_counts (id, run_id, store_code, counted_date, effective_business_date, material_name, unit, physical_qty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id('OPEN'), runId, STORE_CODE, countedDate, businessDate, row.material_name, row.unit, demoOpeningQty(row.material_name, row.unit), createdAt)
  );
}

async function initializeActiveDemoOpeningCounts(db, env) {
  const active = await db.prepare(`SELECT id, business_date FROM demo_sales_runs WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`).first();
  if (!active) throw new Error('请先生成演示销售，再建立首日全物料盘点。');
  const createdAt = now();
  const statements = await demoOpeningCountStatements(db, active.id, active.business_date, createdAt);
  if (!statements.length) throw new Error('尚未读取到可初始化的物料主档，请先完成飞书同步。');
  await db.batch([
    db.prepare(`DELETE FROM demo_opening_inventory_counts WHERE run_id = ?`).bind(active.id),
    ...statements
  ]);
  return { runId: active.id, openingItems: statements.length, sync: await syncFeishuSales(db, env) };
}

async function createDemoSales(db, env) {
  const latestDate = await db.prepare(`SELECT MAX(business_date) AS business_date FROM feishu_sales_records`).first();
  if (!latestDate?.business_date) throw new Error('请先完成一次飞书销售同步，再生成演示销售。');
  const businessDate = chinaBusinessDate();
  const runId = id('DEMO-SALE');
  const createdAt = now();
  const rows = [
    { storeCode: 'STORE001', skuCode: HIGHLIGHT_DEMO_SKU, productName: 'Brown Sugar Boba Milk Tea 400 N', qty: 12, amount: 276 },
    { storeCode: 'STORE001', skuCode: 'SKU013', productName: 'Brown Sugar Boba Milk Tea 500 N', qty: 10, amount: 230 },
    { storeCode: 'STORE001', skuCode: 'SKU003', productName: '桃桃乌龙', qty: 18, amount: 414 }
  ];
  const openingStatements = await demoOpeningCountStatements(db, runId, businessDate, createdAt);
  await db.batch([
    db.prepare(`UPDATE demo_sales_runs SET status = 'reverted', reverted_at = ? WHERE status = 'active'`).bind(createdAt),
    db.prepare(`DELETE FROM demo_opening_inventory_counts`),
    db.prepare(`INSERT INTO demo_sales_runs (id, business_date, status, created_at) VALUES (?, ?, 'active', ?)`)
      .bind(runId, businessDate, createdAt),
    ...rows.map((row) => db.prepare(`INSERT INTO demo_sales_records (id, run_id, store_code, business_date, sku_code, product_name, sales_qty, sales_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id('DS'), runId, row.storeCode, businessDate, row.skuCode, row.productName, row.qty, row.amount, createdAt)),
    ...openingStatements
  ]);
  return { runId, businessDate, rows: rows.length, openingItems: openingStatements.length, sync: await syncFeishuSales(db, env) };
}

async function revertDemoSales(db, env) {
  const active = await db.prepare(`SELECT id FROM demo_sales_runs WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`).first();
  if (!active) return { reverted: false, sync: null };
  await db.batch([
    db.prepare(`UPDATE demo_sales_runs SET status = 'reverted', reverted_at = ? WHERE id = ?`).bind(now(), active.id),
    db.prepare(`DELETE FROM demo_opening_inventory_counts WHERE run_id = ?`).bind(active.id)
  ]);
  return { reverted: true, sync: await syncFeishuSales(db, env) };
}

async function reconcileMaterialInventoryAnomalies(db, calculatedLines, batchId, updatedAt) {
  const policyRows = await db.prepare(`SELECT store_code, material_name, unit, safety_qty, owner FROM material_inventory_policies`).all();
  const policyByMaterial = new Map(policyRows.results.map((policy) => [`${policy.store_code}|${normalizedKey(policy.material_name)}|${policy.unit}`, policy]));
  const candidates = [];
  for (const line of calculatedLines) {
    const policy = policyByMaterial.get(`${line.storeCode}|${normalizedKey(line.material)}|${line.unit}`);
    const safetyQty = policy?.safety_qty ?? null;
    let candidate = null;
    if (line.opening < 0) {
      candidate = {
        ruleCode: 'BASELINE_INVALID', severity: 'high', strategy: 'hq_direct', owner: '数据治理 / 供应链', status: 'pending_hq_governance',
        evidence: `滚动期初 ${line.opening}${line.unit} 已为负数；在期初、收货或历史台账校准前，不应将本次理论期末作为门店经营结论。`
      };
    } else if (line.closing < 0) {
      candidate = {
        ruleCode: 'NEGATIVE_THEORETICAL', severity: 'high', strategy: 'hq_then_store', owner: '总部营运', status: 'pending_hq_decision',
        evidence: `理论期末 ${line.closing}${line.unit}，期初 ${line.opening}${line.unit}，当日 BOM 消耗 ${line.consumption}${line.unit}；数据基础有效后需总部研判是否下发门店核查。`
      };
    } else if (safetyQty != null && line.closing < safetyQty) {
      candidate = {
        ruleCode: 'BELOW_SAFETY_STOCK', severity: 'mid', strategy: 'supply_action', owner: policy.owner || '供应链 / 营运', status: 'pending_supply_action',
        evidence: `理论期末 ${line.closing}${line.unit} 低于安全库存 ${safetyQty}${line.unit}；优先建议补货或调拨，无需默认要求门店盘点。`
      };
    }
    if (candidate) candidates.push({ ...candidate, line, safetyQty });
  }
  const statements = [];
  for (const candidate of candidates) {
    const { line } = candidate;
    statements.push(
      db.prepare(`UPDATE material_inventory_anomalies SET status = 'auto_closed', closed_at = ?, closure_reason = '重新回算后原规则不再触发。', updated_at = ? WHERE store_code = ? AND business_date = ? AND material_name = ? AND rule_code <> ? AND status NOT IN ('closed', 'auto_closed')`)
        .bind(updatedAt, updatedAt, line.storeCode, line.businessDate, line.material, candidate.ruleCode),
      db.prepare(`INSERT INTO material_inventory_anomalies (id, store_code, business_date, material_name, unit, rule_code, severity, strategy, owner, status, theoretical_closing_qty, safety_qty, evidence, source_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(store_code, business_date, material_name, rule_code) DO UPDATE SET severity = excluded.severity, strategy = excluded.strategy, owner = excluded.owner, status = excluded.status, theoretical_closing_qty = excluded.theoretical_closing_qty, safety_qty = excluded.safety_qty, evidence = excluded.evidence, source_batch_id = excluded.source_batch_id, updated_at = excluded.updated_at, closed_at = NULL, closure_reason = NULL`)
        .bind(id('MAT'), line.storeCode, line.businessDate, line.material, line.unit, candidate.ruleCode, candidate.severity, candidate.strategy, candidate.owner, candidate.status, line.closing, candidate.safetyQty, candidate.evidence, batchId, updatedAt, updatedAt)
    );
  }
  const candidateMaterials = new Set(candidates.map((candidate) => `${candidate.line.storeCode}|${candidate.line.businessDate}|${candidate.line.material}`));
  for (const line of calculatedLines) {
    const key = `${line.storeCode}|${line.businessDate}|${line.material}`;
    if (!candidateMaterials.has(key)) {
      statements.push(db.prepare(`UPDATE material_inventory_anomalies SET status = 'auto_closed', closed_at = ?, closure_reason = '重新回算后库存与数据规则均未触发。', updated_at = ? WHERE store_code = ? AND business_date = ? AND material_name = ? AND status NOT IN ('closed', 'auto_closed')`)
        .bind(updatedAt, updatedAt, line.storeCode, line.businessDate, line.material));
    }
  }
  await runInChunks(db, statements);
  return candidates;
}

async function syncFeishuSales(db, env) {
  const batchId = id('IMP');
  const startedAt = now();
  const hasOpeningInventory = await hasD1Table(db, 'demo_opening_inventory_counts');
  const hasMaterialDiagnosis = await hasD1Table(db, 'material_inventory_anomalies');
  await db.prepare(`INSERT INTO feishu_import_batches (id, status, started_at) VALUES (?, 'running', ?)`)
    .bind(batchId, startedAt).run();
  try {
    const token = await getFeishuTenantToken(env);
    const [salesRecords, bomRecords, materialRecords, productRecords, ledgerRecords] = await Promise.all([
      listFeishuRecords(token, FEISHU_SALES_TABLE_ID),
      listFeishuRecords(token, FEISHU_BOM_TABLE_ID),
      listFeishuRecords(token, FEISHU_MATERIAL_TABLE_ID),
      listFeishuRecords(token, FEISHU_PRODUCT_TABLE_ID),
      listFeishuRecords(token, FEISHU_LEDGER_TABLE_ID)
    ]);
    const catalogBySku = new Map();
    const catalogByName = new Map();
    const catalogStatements = [];
    for (const record of productRecords) {
      const fields = record.fields || {};
      const sku = feishuText(fields['SKU编码']);
      const productName = feishuText(fields['商品名称']);
      if (!sku || !productName) continue;
      const aliases = namesFromCatalog(fields);
      catalogBySku.set(sku, { sku, productName, aliases });
      for (const name of aliases) catalogByName.set(normalizedKey(name), sku);
      catalogStatements.push(
        db.prepare(`INSERT INTO feishu_product_catalog (sku_code, product_name, aliases, source_record_id, updated_at) VALUES (?, ?, ?, ?, ?)`)
          .bind(sku, productName, aliases.join('、'), record.record_id || null, startedAt)
      );
    }
    const materialUnits = new Map(materialRecords.map((record) => [feishuText(record.fields?.['物料名称']), feishuText(record.fields?.['单位'])]));
    const bomBySku = new Map();
    const bomStatements = [];
    for (const record of bomRecords) {
      const fields = record.fields || {};
      const sku = feishuText(fields['SKU编码']);
      const material = feishuText(fields['物料名称']);
      const usage = feishuNumber(fields['用量']);
      if (!sku || !material || usage == null || usage <= 0) continue;
      const line = { material, usage, unit: feishuText(fields['单位']) || materialUnits.get(material) || '未配置单位' };
      bomBySku.set(sku, [...(bomBySku.get(sku) || []), line]);
      bomStatements.push(
        db.prepare(`INSERT INTO feishu_bom_lines (source_record_id, sku_code, material_name, unit, usage_per_sale, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(record.record_id, sku, material, line.unit, usage, startedAt)
      );
    }
    const consumption = new Map();
    const salesStatements = [];
    let importedRecords = 0;
    let mappedSalesRecords = 0;
    let unmappedSalesRecords = 0;
    for (const record of salesRecords) {
      const fields = record.fields || {};
      const storeCode = feishuText(fields['门店编码关联']);
      const businessDate = feishuDate(fields['日期']);
      const directSku = feishuText(fields['SKU Code']);
      const productName = feishuText(fields['商品']) || feishuText(fields['商品名称(OCR)']);
      const salesQty = feishuNumber(fields['销售数量']);
      if (!record.record_id || !storeCode || !businessDate || salesQty == null || salesQty < 0) continue;
      importedRecords += 1;
      const skuCode = (catalogBySku.has(directSku) || bomBySku.has(directSku))
        ? directSku
        : catalogByName.get(normalizedKey(productName)) || directSku;
      const bomLines = bomBySku.get(skuCode) || [];
      if (bomLines.length) mappedSalesRecords += 1;
      else unmappedSalesRecords += 1;
      salesStatements.push(
        db.prepare(`INSERT INTO feishu_sales_records (feishu_record_id, batch_id, business_date, store_code, sku_code, product_name, sales_qty, sales_amount, verified, confidence, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(feishu_record_id) DO UPDATE SET batch_id = excluded.batch_id, business_date = excluded.business_date, store_code = excluded.store_code, sku_code = excluded.sku_code, product_name = excluded.product_name, sales_qty = excluded.sales_qty, sales_amount = excluded.sales_amount, verified = excluded.verified, confidence = excluded.confidence, updated_at = excluded.updated_at`)
          .bind(record.record_id, batchId, businessDate, storeCode, skuCode || null, productName || null, salesQty, feishuNumber(fields['销售金额']), fields['已核对'] ? 1 : 0, feishuText(fields['识别置信度']) || null, startedAt)
      );
      for (const line of bomLines) {
        const key = `${storeCode}|${businessDate}|${line.material}|${line.unit}`;
        const current = consumption.get(key) || { storeCode, businessDate, material: line.material, unit: line.unit, theoreticalQty: 0, sourceSalesQty: 0 };
        current.theoreticalQty += salesQty * line.usage;
        current.sourceSalesQty += salesQty;
        consumption.set(key, current);
      }
    }
    const demoSales = await activeDemoSales(db);
    const demoOpeningCounts = hasOpeningInventory
      ? await db.prepare(`SELECT c.store_code, c.counted_date, c.effective_business_date, c.material_name, c.unit, c.physical_qty FROM demo_opening_inventory_counts c JOIN demo_sales_runs run ON run.id = c.run_id WHERE run.status = 'active'`).all()
      : { results: [] };
    for (const row of demoSales.results) {
      const bomLines = bomBySku.get(row.sku_code) || [];
      for (const line of bomLines) {
        const key = `${row.store_code}|${row.business_date}|${line.material}|${line.unit}`;
        const current = consumption.get(key) || { storeCode: row.store_code, businessDate: row.business_date, material: line.material, unit: line.unit, theoreticalQty: 0, sourceSalesQty: 0 };
        current.theoreticalQty += Number(row.sales_qty) * line.usage;
        current.sourceSalesQty += Number(row.sales_qty);
        consumption.set(key, current);
      }
    }
    await db.batch([db.prepare('DELETE FROM feishu_product_catalog'), db.prepare('DELETE FROM feishu_bom_lines')]);
    await runInChunks(db, catalogStatements);
    await runInChunks(db, bomStatements);
    await runInChunks(db, salesStatements);
    await db.prepare('DELETE FROM feishu_material_consumption_daily').run();
    const consumptionStatements = Array.from(consumption.values()).map((line) =>
      db.prepare(`INSERT INTO feishu_material_consumption_daily (store_code, business_date, material_name, unit, theoretical_qty, source_sales_qty, last_batch_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(line.storeCode, line.businessDate, line.material, line.unit, line.theoreticalQty, line.sourceSalesQty, batchId, startedAt)
    );
    await runInChunks(db, consumptionStatements);
    const ledgerSource = new Map();
    for (const record of ledgerRecords) {
      const fields = record.fields || {};
      const storeCode = feishuText(fields['门店编码关联']);
      const businessDate = feishuDate(fields['日期']);
      const material = feishuText(fields['物料名称']);
      if (!storeCode || !businessDate || !material) continue;
      const unit = materialUnits.get(material) || '未配置单位';
      ledgerSource.set(`${storeCode}|${businessDate}|${normalizedKey(material)}`, {
        storeCode, businessDate, material, unit, recordId: record.record_id || null,
        opening: feishuNumber(fields['期初库存']), receipt: feishuNumber(fields['入库量']) || 0,
        scrap: feishuNumber(fields['报损量']) || 0, transferIn: feishuNumber(fields['调拨入量']) || 0,
        transferOut: feishuNumber(fields['调拨出量']) || 0, closing: feishuNumber(fields['期末库存'])
      });
    }
    const sourceStatements = [];
    for (const line of ledgerSource.values()) {
      sourceStatements.push(
        db.prepare(`INSERT INTO feishu_inventory_source_daily (store_code, business_date, material_name, unit, opening_qty, receipt_qty, scrap_qty, transfer_in_qty, transfer_out_qty, source_closing_qty, source_record_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(line.storeCode, line.businessDate, line.material, line.unit, line.opening, line.receipt, line.scrap, line.transferIn, line.transferOut, line.closing, line.recordId, startedAt)
      );
    }
    const derived = new Map();
    for (const line of ledgerSource.values()) derived.set(`${line.storeCode}|${line.businessDate}|${normalizedKey(line.material)}`, { ...line, consumption: 0 });
    for (const line of consumption.values()) {
      const key = `${line.storeCode}|${line.businessDate}|${normalizedKey(line.material)}`;
      const previous = Array.from(ledgerSource.values())
        .filter((source) => source.storeCode === line.storeCode && normalizedKey(source.material) === normalizedKey(line.material) && source.businessDate < line.businessDate && source.closing != null)
        .sort((a, b) => b.businessDate.localeCompare(a.businessDate))[0];
      const existing = derived.get(key) || { storeCode: line.storeCode, businessDate: line.businessDate, material: line.material, unit: line.unit, opening: previous?.closing || 0, receipt: 0, scrap: 0, transferIn: 0, transferOut: 0, closing: null, consumption: 0 };
      existing.consumption += line.theoreticalQty;
      derived.set(key, existing);
    }
    for (const opening of demoOpeningCounts.results) {
      const key = `${opening.store_code}|${opening.effective_business_date}|${normalizedKey(opening.material_name)}`;
      const existing = derived.get(key) || {
        storeCode: opening.store_code, businessDate: opening.effective_business_date, material: opening.material_name,
        unit: opening.unit, opening: 0, receipt: 0, scrap: 0, transferIn: 0, transferOut: 0, closing: null, consumption: 0
      };
      existing.unit = opening.unit;
      existing.opening = Number(opening.physical_qty);
      existing.closing = null;
      derived.set(key, existing);
    }
    const derivedStatements = [];
    const calculatedLines = [];
    for (const line of derived.values()) {
      const opening = line.opening || 0;
      const closing = opening + line.receipt + line.transferIn - line.transferOut - line.scrap - line.consumption;
      const delta = line.closing == null ? null : line.closing - closing;
      calculatedLines.push({ ...line, opening, closing });
      derivedStatements.push(
        db.prepare(`INSERT INTO derived_inventory_ledger_daily (store_code, business_date, material_name, unit, opening_qty, receipt_qty, transfer_in_qty, transfer_out_qty, scrap_qty, bom_consumption_qty, theoretical_closing_qty, source_closing_qty, reconciliation_delta, last_batch_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(line.storeCode, line.businessDate, line.material, line.unit, opening, line.receipt, line.transferIn, line.transferOut, line.scrap, line.consumption, closing, line.closing, delta, batchId, startedAt)
      );
    }
    await db.batch([db.prepare('DELETE FROM feishu_inventory_source_daily'), db.prepare('DELETE FROM derived_inventory_ledger_daily')]);
    await runInChunks(db, sourceStatements);
    await runInChunks(db, derivedStatements);
    if (hasMaterialDiagnosis) await reconcileMaterialInventoryAnomalies(db, calculatedLines, batchId, startedAt);
    const completedAt = now();
    await db.prepare(`UPDATE feishu_import_batches SET status = 'completed', completed_at = ?, scanned_records = ?, imported_records = ?, mapped_sales_records = ?, unmapped_sales_records = ? WHERE id = ?`)
      .bind(completedAt, salesRecords.length, importedRecords, mappedSalesRecords, unmappedSalesRecords, batchId).run();
    return { batchId, status: 'completed', scannedRecords: salesRecords.length, importedRecords, mappedSalesRecords, unmappedSalesRecords, materialLines: consumption.size, completedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.prepare(`UPDATE feishu_import_batches SET status = 'failed', completed_at = ?, error_message = ? WHERE id = ?`)
      .bind(now(), message.slice(0, 500), batchId).run();
    throw error;
  }
}

async function feishuSyncState(db) {
  const hasOpeningInventory = await hasD1Table(db, 'demo_opening_inventory_counts');
  const hasMaterialDiagnosis = await hasD1Table(db, 'material_inventory_anomalies');
  const latestBatch = await db.prepare(`SELECT id, status, started_at, completed_at, scanned_records, imported_records, mapped_sales_records, unmapped_sales_records, error_message FROM feishu_import_batches ORDER BY started_at DESC LIMIT 1`).first();
  const groups = await db.prepare(`WITH all_sales AS (SELECT store_code, business_date, sales_qty, sales_amount FROM feishu_sales_records UNION ALL SELECT r.store_code, r.business_date, r.sales_qty, r.sales_amount FROM demo_sales_records r JOIN demo_sales_runs run ON run.id = r.run_id WHERE run.status = 'active') SELECT store_code, business_date, COUNT(*) AS sales_lines, ROUND(SUM(sales_qty), 2) AS sales_qty, ROUND(SUM(sales_amount), 2) AS sales_amount FROM all_sales GROUP BY store_code, business_date ORDER BY business_date DESC, store_code ASC LIMIT 12`).all();
  const latestGroup = groups.results[0] || null;
  const materialRows = latestGroup
    ? await db.prepare(`SELECT material_name, unit, ROUND(theoretical_qty, 3) AS theoretical_qty, ROUND(source_sales_qty, 2) AS source_sales_qty FROM feishu_material_consumption_daily WHERE store_code = ? AND business_date = ? ORDER BY theoretical_qty DESC LIMIT 12`).bind(latestGroup.store_code, latestGroup.business_date).all()
    : { results: [] };
  const ledgerRows = latestGroup
    ? await db.prepare(`SELECT material_name, unit, ROUND(opening_qty, 3) AS opening_qty, ROUND(receipt_qty, 3) AS receipt_qty, ROUND(transfer_in_qty, 3) AS transfer_in_qty, ROUND(transfer_out_qty, 3) AS transfer_out_qty, ROUND(scrap_qty, 3) AS scrap_qty, ROUND(bom_consumption_qty, 3) AS bom_consumption_qty, ROUND(theoretical_closing_qty, 3) AS theoretical_closing_qty, ROUND(source_closing_qty, 3) AS source_closing_qty, ROUND(reconciliation_delta, 3) AS reconciliation_delta FROM derived_inventory_ledger_daily WHERE store_code = ? AND business_date = ? ORDER BY ABS(COALESCE(reconciliation_delta, 0)) DESC, material_name ASC LIMIT 20`).bind(latestGroup.store_code, latestGroup.business_date).all()
    : { results: [] };
  const materialSkuContributors = latestGroup
    ? await db.prepare(`WITH all_sales AS (
        SELECT store_code, business_date, sku_code, product_name, sales_qty FROM feishu_sales_records
        UNION ALL
        SELECT r.store_code, r.business_date, r.sku_code, r.product_name, r.sales_qty
        FROM demo_sales_records r JOIN demo_sales_runs run ON run.id = r.run_id WHERE run.status = 'active'
      )
      SELECT b.material_name, b.unit, s.sku_code, MAX(s.product_name) AS product_name,
        ROUND(SUM(s.sales_qty), 2) AS sales_qty, ROUND(b.usage_per_sale, 3) AS usage_per_sale,
        ROUND(SUM(s.sales_qty * b.usage_per_sale), 3) AS consumption_qty
      FROM all_sales s JOIN feishu_bom_lines b ON b.sku_code = s.sku_code
      WHERE s.store_code = ? AND s.business_date = ?
      GROUP BY b.material_name, b.unit, s.sku_code, b.usage_per_sale
      ORDER BY b.material_name, s.sku_code`).bind(latestGroup.store_code, latestGroup.business_date).all()
    : { results: [] };
  const contributorsByMaterial = new Map();
  for (const contributor of materialSkuContributors.results) {
    const key = `${normalizedKey(contributor.material_name)}|${contributor.unit}`;
    contributorsByMaterial.set(key, [...(contributorsByMaterial.get(key) || []), contributor]);
  }
  const latestMaterialAnomalies = hasMaterialDiagnosis && latestGroup
    ? await db.prepare(`SELECT * FROM material_inventory_anomalies WHERE store_code = ? AND business_date = ? ORDER BY CASE severity WHEN 'high' THEN 0 ELSE 1 END, updated_at DESC`).bind(latestGroup.store_code, latestGroup.business_date).all()
    : { results: [] };
  const anomalyByMaterial = new Map(latestMaterialAnomalies.results.filter((item) => !['closed', 'auto_closed'].includes(item.status)).map((item) => [`${normalizedKey(item.material_name)}|${item.unit}`, item]));
  const ledgerRowsWithContributors = ledgerRows.results.map((row) => ({
    ...row,
    sku_contributors: contributorsByMaterial.get(`${normalizedKey(row.material_name)}|${row.unit}`) || [],
    anomaly: anomalyByMaterial.get(`${normalizedKey(row.material_name)}|${row.unit}`) || null
  }));
  const mapping = await db.prepare(`SELECT (SELECT COUNT(*) FROM feishu_product_catalog) AS product_skus, (SELECT COUNT(DISTINCT sku_code) FROM feishu_bom_lines) AS bom_skus, (SELECT COUNT(*) FROM feishu_bom_lines) AS bom_lines`).first();
  const demoRun = await db.prepare(`SELECT run.id, run.business_date, run.created_at, COUNT(r.id) AS records, ROUND(SUM(r.sales_qty), 2) AS sales_qty FROM demo_sales_runs run LEFT JOIN demo_sales_records r ON r.run_id = run.id WHERE run.status = 'active' GROUP BY run.id, run.business_date, run.created_at ORDER BY run.created_at DESC LIMIT 1`).first();
  const demoBaseline = hasOpeningInventory && demoRun
    ? await db.prepare(`SELECT counted_date, effective_business_date, COUNT(*) AS material_count FROM demo_opening_inventory_counts WHERE run_id = ? GROUP BY counted_date, effective_business_date`).bind(demoRun.id).first()
    : null;
  const highlightSale = await db.prepare(`WITH all_sales AS (SELECT store_code, business_date, sku_code, product_name, sales_qty FROM feishu_sales_records UNION ALL SELECT r.store_code, r.business_date, r.sku_code, r.product_name, r.sales_qty FROM demo_sales_records r JOIN demo_sales_runs run ON run.id = r.run_id WHERE run.status = 'active') SELECT store_code, business_date, sku_code, product_name, ROUND(SUM(sales_qty), 2) AS sales_qty FROM all_sales WHERE sku_code = ? GROUP BY store_code, business_date, sku_code, product_name ORDER BY business_date DESC, store_code ASC LIMIT 1`).bind(HIGHLIGHT_DEMO_SKU).first();
  const highlightRows = highlightSale
    ? await db.prepare(`SELECT b.material_name, b.unit, ROUND(b.usage_per_sale, 3) AS usage_per_sale, ROUND(? * b.usage_per_sale, 3) AS calculated_qty, ROUND(COALESCE(d.bom_consumption_qty, 0) - (? * b.usage_per_sale), 3) AS other_bom_consumption_qty, ROUND(d.bom_consumption_qty, 3) AS daily_bom_consumption_qty, ROUND(d.opening_qty, 3) AS opening_qty, ROUND(d.theoretical_closing_qty, 3) AS theoretical_closing_qty, ROUND(d.source_closing_qty, 3) AS source_closing_qty FROM feishu_bom_lines b LEFT JOIN derived_inventory_ledger_daily d ON d.store_code = ? AND d.business_date = ? AND lower(replace(replace(replace(replace(replace(b.material_name, ' ', ''), '-', ''), '/', ''), '，', ''), ',', '')) = lower(replace(replace(replace(replace(replace(d.material_name, ' ', ''), '-', ''), '/', ''), '，', ''), ',', '')) WHERE b.sku_code = ? ORDER BY b.material_name ASC`).bind(highlightSale.sales_qty, highlightSale.sales_qty, highlightSale.store_code, highlightSale.business_date, HIGHLIGHT_DEMO_SKU).all()
    : { results: [] };
  const highlightOtherContributors = highlightSale
    ? await db.prepare(`WITH all_sales AS (
        SELECT store_code, business_date, sku_code, product_name, sales_qty FROM feishu_sales_records
        UNION ALL
        SELECT r.store_code, r.business_date, r.sku_code, r.product_name, r.sales_qty
        FROM demo_sales_records r JOIN demo_sales_runs run ON run.id = r.run_id WHERE run.status = 'active'
      )
      SELECT b.material_name, b.unit, s.sku_code, MAX(s.product_name) AS product_name,
        ROUND(SUM(s.sales_qty), 2) AS sales_qty, ROUND(b.usage_per_sale, 3) AS usage_per_sale,
        ROUND(SUM(s.sales_qty * b.usage_per_sale), 3) AS consumption_qty
      FROM all_sales s JOIN feishu_bom_lines b ON b.sku_code = s.sku_code
      WHERE s.store_code = ? AND s.business_date = ? AND s.sku_code <> ?
      GROUP BY b.material_name, b.unit, s.sku_code, b.usage_per_sale
      ORDER BY b.material_name, s.sku_code`).bind(highlightSale.store_code, highlightSale.business_date, HIGHLIGHT_DEMO_SKU).all()
    : { results: [] };
  const otherContributorsByMaterial = new Map();
  for (const contributor of highlightOtherContributors.results) {
    const key = `${normalizedKey(contributor.material_name)}|${contributor.unit}`;
    otherContributorsByMaterial.set(key, [...(otherContributorsByMaterial.get(key) || []), contributor]);
  }
  const highlightRowsWithContributors = highlightRows.results.map((row) => ({
    ...row,
    other_sku_contributors: otherContributorsByMaterial.get(`${normalizedKey(row.material_name)}|${row.unit}`) || []
  }));
  const unmappedSkus = await db.prepare(`SELECT COALESCE(s.sku_code, '未识别 SKU') AS sku_code, COALESCE(s.product_name, '未识别商品') AS product_name, COUNT(*) AS sales_records, ROUND(SUM(s.sales_qty), 2) AS sales_qty FROM feishu_sales_records s LEFT JOIN (SELECT DISTINCT sku_code FROM feishu_bom_lines) b ON b.sku_code = s.sku_code WHERE b.sku_code IS NULL GROUP BY s.sku_code, s.product_name ORDER BY sales_qty DESC LIMIT 12`).all();
  const coverage = latestBatch && latestBatch.imported_records
    ? Math.round((latestBatch.mapped_sales_records / latestBatch.imported_records) * 100)
    : 0;
  return { source: { name: '飞书 · 门店库存管理数据中心', tables: ['门店销售明细', '商品SKU主档', '商品BOM', '门店库存台账'], syncSchedule: '每 10 分钟' }, latestBatch: latestBatch || null, coverage, mapping: mapping || { product_skus: 0, bom_skus: 0, bom_lines: 0 }, demo: demoRun || null, demoBaseline: demoBaseline || null, groups: groups.results, latestGroup, materials: materialRows.results, ledger: ledgerRowsWithContributors, materialAnomalies: latestMaterialAnomalies.results, unmappedSkus: unmappedSkus.results, highlight: highlightSale ? { sale: highlightSale, rows: highlightRowsWithContributors } : null, calculation: { formula: '期初 + 入库 + 调拨入 − 调拨出 − 报损 − 销售×BOM用量 = 理论期末', rollover: '若当天缺少飞书库存台账，取同门店同物料最近一日台账期末作为滚动期初；演示销售有首日实盘基线时优先使用该基线。', writeback: '只读飞书，计算结果存入 Demo 私有数据库，不回写原始表' } };
}

// 飞书在保存“事件发送至开发者服务器”配置时，会用 url_verification
// 事件校验地址。这里必须同步、快速返回 challenge，不能等待任何数据库
// 或第三方调用；实际的销售 Excel 导入会在后续单独接入并校验签名。
async function receiveFeishuEvent(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return bad('飞书事件格式不正确。');

  // 新旧飞书校验请求均以 challenge 为准；部分代理会省略 type，
  // 因此不能只依赖 type 判断，否则会导致平台一直等待超时。
  if (body.type === 'url_verification' || typeof body.challenge === 'string') {
    // 开发阶段允许未配置 token 时完成 URL 校验。真正开始处理业务事件前，
    // 会在 Worker 密钥中配置 FEISHU_VERIFICATION_TOKEN 并启用严格校验。
    if (env.FEISHU_VERIFICATION_TOKEN && body.token !== env.FEISHU_VERIFICATION_TOKEN) {
      return bad('飞书校验 Token 不匹配。', 403);
    }
    return json({ challenge: body.challenge });
  }

  // 先确认收到事件，避免飞书重复投递。文件下载、签名验真和 Excel 入库
  // 会在下一步接入 im.message.receive_v1 后启用。
  return json({ code: 0, message: 'event_received' });
}

// 门店端 AI 助手只负责识别意图、查询和生成“待确认”的 UI 指令。库存变更
// 仍须由门店在现有表单中确认提交，避免把 LLM 或语音识别结果直接写入流水。
// 未来接入豆包 / OpenAI function calling 时，模型也只能返回下列 ui_action
// 结构；密钥始终只保存在 Worker secret，绝不下发到 HTML。
function r2StoreAgentNumber(message) {
  const match = String(message || '').match(/(?<![A-Za-z0-9])(\d+(?:\.\d+)?)\s*(kg|kilograms?|公斤|千克|g|grams?|克|l|liters?|litres?|liter|升|个|只|pcs?|pieces?|buah)?/i);
  if (!match) return { qty: null, unit: null };
  const rawUnit = String(match[2] || '').toLowerCase();
  const unit = /kg|kilogram|公斤|千克/.test(rawUnit) ? 'kg' : /g|gram|克/.test(rawUnit) ? 'g' : /l|liter|litre|升/.test(rawUnit) ? 'L' : /个|只|pcs?|piece|buah/.test(rawUnit) ? '个' : null;
  return { qty: Number(match[1]), unit };
}

function r2StoreAgentBaseQuantity(material, qty, inputUnit) {
  const numeric = Number(qty);
  if (!Number.isFinite(numeric) || numeric <= 0) return { qty: '', unit: material?.unit || inputUnit || '' };
  const baseUnit = material?.unit || inputUnit || '';
  if (baseUnit === 'g' && inputUnit === 'kg') return { qty: r2Round(numeric * 1000), unit: 'g' };
  if (baseUnit === 'kg' && inputUnit === 'g') return { qty: r2Round(numeric / 1000), unit: 'kg' };
  return { qty: numeric, unit: baseUnit };
}

function r2StoreAgentDestination(message) {
  const text = String(message || '').toUpperCase();
  const match = text.match(/STORE\s*0*(\d{1,4})\b/) || text.match(/(?:去|到|至)\s*0*(\d{1,4})\s*(?:店|门店)?/);
  if (match) return `STORE${String(match[1]).padStart(3, '0')}`;
  const normalizedMessage = normalizedKey(message);
  // “小茶日记”是“小茶日记·Pro店”的前缀；优先最长门店名，避免误指向 STORE001。
  const knownStore = R2_STORE_MASTERS
    .map((item) => ({ item, name: normalizedKey(item.store_name) }))
    .filter(({ name }) => normalizedMessage.includes(name) || name.includes(normalizedMessage))
    .sort((left, right) => right.name.length - left.name.length)[0]?.item;
  return knownStore?.store_code || null;
}

function r2StoreAgentMaterial(rows, message) {
  return r2StoreAgentMaterials(rows, message)[0] || null;
}

function r2StoreAgentMaterials(rows, message) {
  const normalizedMessage = normalizedKey(message);
  if (!normalizedMessage) return [];
  const matches = [];
  const occupied = [];
  const candidates = rows.map((row) => ({ row, key: normalizedKey(row.material_name) })).filter((item) => item.key).sort((a, b) => b.key.length - a.key.length);
  for (const candidate of candidates) {
    let offset = 0;
    while (offset < normalizedMessage.length) {
      const start = normalizedMessage.indexOf(candidate.key, offset);
      if (start < 0) break;
      const end = start + candidate.key.length;
      if (!occupied.some((range) => start < range.end && end > range.start)) {
        matches.push({ row:candidate.row, start }); occupied.push({ start, end }); break;
      }
      offset = start + 1;
    }
  }
  const aliases = [
    { names: ['milk', 'susu'], material: '牛奶' },
    { names: ['freshmilk', 'sususegar'], material: '鲜牛奶' },
    { names: ['黑糖', 'brownsugarpearl', 'brownsugarboba', 'mutiaragulamerah', 'bobagulamerah'], material: '黑糖珍珠' },
    { names: ['tea', 'daunteh'], material: '茶叶' },
    { names: ['straw', 'sedotan'], material: '吸管' },
    { names: ['plasticcup', 'gelasplastik'], material: '塑料杯' }
  ];
  for (const alias of aliases) {
    const aliasPositions = alias.names.map((name) => normalizedMessage.indexOf(normalizedKey(name))).filter((position) => position >= 0);
    if (!aliasPositions.length) continue;
    const row = rows.find((item) => normalizedKey(item.material_name) === normalizedKey(alias.material));
    if (row && !matches.some((item) => item.row.material_name === row.material_name)) matches.push({ row, start:Math.min(...aliasPositions) });
  }
  return matches.sort((a, b) => a.start - b.start).map((item) => item.row).slice(0, 12);
}

function r2StoreAgentReason(message) {
  const text = String(message || '');
  if (/过期|过了保质期|expired|kedaluwarsa|kadaluarsa/i.test(text)) return '过期';
  if (/破损|破了|碎|broken|damaged|rusak|pecah/i.test(text)) return '破损';
  if (/变质|坏了|烂了|酸了|spoiled|basi/i.test(text)) return '变质';
  if (/洒|漏|spill|leak|tumpah|bocor/i.test(text)) return '洒漏';
  return null;
}

const R2_ARK_CHAT_COMPLETIONS = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
// 当前密钥可直接调用的方舟模型；可由线上 DOUBAO_MODEL Secret 覆盖。
// API Key 始终仅存在 Worker Secret 中。
const R2_ARK_STORE_AGENT_MODEL = 'glm-5-3-flash-260828';

function r2StoreAgentTools() {
  return [
    { type: 'function', function: { name: 'transfer_stok', description: '发起门店调拨草稿。只有用户明确要调拨、调出或转给其他门店时调用。可一对多：每个调入门店单独给出数量；不能编造门店或数量。', parameters: { type: 'object', properties: { material: { type: 'string' }, qty: { type: 'number', description: '仅单一调入门店时使用' }, unit: { type: 'string', enum: ['kg', 'L', '个'] }, to_store: { type: 'string', description: '仅单一调入门店，例如 STORE002' }, destinations: { type: 'array', description: '一对多调拨的调入门店与对应数量', items: { type: 'object', properties: { store_code: { type: 'string' }, qty: { type: 'number' } }, required: ['store_code', 'qty'] } } }, required: [] } } },
    { type: 'function', function: { name: 'lapor_kerugian', description: '登记物料报损。报损、损耗、烂了、坏了、过期、破损或洒漏均使用此工具。', parameters: { type: 'object', properties: { material: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string', enum: ['kg', 'L', '个'] }, reason: { type: 'string', enum: ['破损', '过期', '变质', '洒漏'] } }, required: [] } } },
    { type: 'function', function: { name: 'create_receipt_order_draft', description: '建立门店收货单草稿。只建立单据，不改变库存；之后必须由店员在单据详情确认收货。', parameters: { type: 'object', properties: { material: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string', enum: ['kg', 'L', '个'] } }, required: [] } } },
    { type: 'function', function: { name: 'stok_opname', description: '发起门店盘点；用户提到盘点、盘库、清点时调用。', parameters: { type: 'object', properties: { material: { type: 'string', description: '指定物料；全盘时可不传' } }, required: [] } } },
    { type: 'function', function: { name: 'create_purchase_order_draft', description: '建立订货单草稿。用户说订货、补货、缺货、要货或库存不足时调用；只建草稿，不自动提交。', parameters: { type: 'object', properties: { material: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string', enum: ['kg', 'L', '个'] }, urgency: { type: 'string', enum: ['normal', 'urgent', 'critical'] }, reason: { type: 'string' } }, required: [] } } },
    { type: 'function', function: { name: 'query_inventory', description: '查询一个或多个物料的当前理论库存。用户提到多个物料时必须全部放入 materials，不得只返回第一个。', parameters: { type: 'object', properties: { material: { type: 'string', description:'单物料查询时使用' }, materials: { type:'array', description:'多物料查询时使用，保留用户提到的全部物料', items:{ type:'string' } } }, required: [] } } }
  ];
}

function r2StoreAgentLlmAction(toolName, args, rows) {
  const material = r2StoreAgentMaterial(rows, args.material || args.material_name || '') || (args.material ? { material_name: String(args.material).trim(), unit: args.unit || '' } : null);
  const qty = Number(args.qty ?? args.quantity);
  const normalizedQuantity = r2StoreAgentBaseQuantity(material, qty, args.unit || '');
  const safeQty = normalizedQuantity.qty;
  const unit = normalizedQuantity.unit;
  const prefill = { material_name: material?.material_name || '', unit, qty: safeQty };
  if (toolName === 'transfer_stok') {
    const requested = Array.isArray(args.destinations) ? args.destinations : [];
    const destinations = requested.map((item) => ({ store_code: r2StoreAgentDestination(item?.store_code || item?.to_store || ''), qty: Number(item?.qty) }))
      .filter((item) => item.store_code && Number.isFinite(item.qty) && item.qty > 0)
      .slice(0, 8);
    const toStore = r2StoreAgentDestination(args.to_store || args.destination || '');
    if (!destinations.length && toStore) destinations.push({ store_code: toStore, qty: safeQty || '' });
    return { type: 'open_transfer', prefill: { ...prefill, to_store_code: destinations[0]?.store_code || '', destinations } };
  }
  if (toolName === 'lapor_kerugian') return { type: 'open_scrap', prefill: { ...prefill, reason: r2StoreAgentReason(args.reason || '') || String(args.reason || '').trim() } };
  if (['create_receipt_order_draft', 'receipt_inventory'].includes(toolName)) return { type: 'open_receipt', prefill };
  if (toolName === 'stok_opname') return { type: 'open_count', prefill: { material_name: material?.material_name || '' } };
  if (['create_purchase_order_draft', 'request_restock'].includes(toolName)) return { type: 'open_restock', prefill: { ...prefill, urgency: ['urgent', 'critical'].includes(args.urgency) ? args.urgency : 'normal', reason: String(args.reason || '').trim() } };
  if (toolName === 'query_inventory') {
    const requested = Array.isArray(args.materials) ? args.materials : [args.material || args.material_name || ''];
    const items = [...new Map(requested.flatMap((name) => r2StoreAgentMaterials(rows, name)).map((item) => [item.material_name, item])).values()]
      .map((item) => ({ material_name:item.material_name, unit:item.unit, theoretical_closing_qty:Number(item.theoretical_closing_qty || 0), safety_qty:item.safety_qty ?? null }));
    if (!items.length && material) items.push({ material_name:material.material_name, unit:material.unit, theoretical_closing_qty:Number(material.theoretical_closing_qty || 0), safety_qty:material.safety_qty ?? null });
    return { type:'show_inventory', data: items.length ? { ...items[0], items } : null };
  }
  return null;
}

function r2StoreAgentReplyForAction(action) {
  if (!action) return null;
  const value = action.prefill || action.data || {};
  if (action.type === 'open_transfer') return '我已识别到调拨需求。可同时填写多个调入门店；请核对每家数量后确认提交。';
  if (action.type === 'open_scrap') return '我已识别到报损需求。请补全缺少的信息并上传照片凭证。';
  if (action.type === 'open_receipt') return '我已识别到收货需求。请补全信息后建立收货单草稿；草稿不会改变库存，进入详情确认后才入账。';
  if (action.type === 'open_restock') return '我已识别到订货需求。请补全原因后建立订货单草稿；进入详情确认后才正式提交。';
  if (action.type === 'open_count') return value.material_name ? `我会为你打开 ${value.material_name} 的盘点入口，请拍照识别后确认异常项。` : '我已为你打开今日盘点入口，请拍照识别后确认异常项。';
  if (action.type === 'show_inventory' && Array.isArray(value.items) && value.items.length) return value.items.map((item) => `${item.material_name}：${r2Round(Number(item.theoretical_closing_qty || 0))} ${item.unit || ''}${item.safety_qty != null ? `（安全库存 ${r2Round(item.safety_qty)} ${item.unit || ''}）` : ''}`).join('\n');
  if (action.type === 'show_inventory' && value.material_name) return `${value.material_name} 当前理论库存为 ${r2Round(Number(value.theoretical_closing_qty || 0))} ${value.unit || ''}。`;
  return null;
}

function r2StoreAgentActionIntent(action) {
  return ({ open_transfer: 'transfer', open_scrap: 'scrap', open_receipt: 'receipt', open_count: 'count', open_restock: 'restock' })[action?.type] || null;
}

// Function calling 每轮只返回本轮识别到的槽位。合并上轮草稿，避免第二轮补充
// “牛奶 2L”时把第一轮已经确认的调入门店丢掉。
function r2StoreAgentMergeActionDraft(action, currentDraft) {
  const intent = r2StoreAgentActionIntent(action);
  if (!intent || !action?.prefill) return { action, draft: currentDraft };
  const previous = currentDraft?.intent === intent && currentDraft.values && typeof currentDraft.values === 'object' ? currentDraft.values : {};
  const next = action.prefill && typeof action.prefill === 'object' ? action.prefill : {};
  const preferNext = (key, fallback = '') => next[key] !== undefined && next[key] !== null && next[key] !== '' ? next[key] : (previous[key] ?? fallback);
  const validDestinations = (items) => Array.isArray(items)
    ? items.map((item) => ({ store_code: String(item?.store_code || '').trim(), qty: Number(item?.qty) > 0 ? Number(item.qty) : '' })).filter((item) => item.store_code || item.qty).slice(0, 8)
    : [];
  const nextDestinations = validDestinations(next.destinations);
  const previousDestinations = validDestinations(previous.destinations);
  const destinations = nextDestinations.length ? nextDestinations : previousDestinations;
  const toStore = preferNext('to_store_code', destinations[0]?.store_code || '');
  const values = {
    material_name: preferNext('material_name'), unit: preferNext('unit'), qty: preferNext('qty'),
    to_store_code: toStore || destinations[0]?.store_code || '', destinations,
    reason: preferNext('reason'), urgency: preferNext('urgency', 'normal'),
    plan_no: preferNext('plan_no'), request_id: preferNext('request_id'), direction: preferNext('direction')
  };
  return { action: { ...action, prefill: values }, draft: { intent, values } };
}

async function r2StoreAgentWithArk(env, message, storeCode, rows, history = [], currentDraft = null, todayTasks = []) {
  if (!env.DOUBAO_API_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const materials = rows.map((row) => `${row.material_name}（${row.unit}）`).slice(0, 80).join('、');
    const stores = R2_STORE_MASTERS.map((item) => `${item.store_code}=${item.store_name}`).join('；');
    const response = await fetch(R2_ARK_CHAT_COMPLETIONS, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${env.DOUBAO_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.DOUBAO_MODEL || R2_ARK_STORE_AGENT_MODEL,
        temperature: 0.1,
        thinking: { type: 'disabled' },
        messages: [
          { role: 'system', content: `你是 ${storeCode} 的门店运营助手。理解中文、English 和 Bahasa Indonesia，并使用用户当前语言简短回复。仅处理调拨、报损、收货、盘点、订货/补货和查库存。收货必须调用 create_receipt_order_draft；订货、补货、缺货和要货必须调用 create_purchase_order_draft。两个工具都只建立草稿，不改变库存、不自动提交。参数不全时仍调用对应工具并只填写确定字段。查询库存时，用户提到多个物料必须将全部名称放入 query_inventory.materials，不得遗漏。用户问今日待办、帮我完成待办或今天做什么时，先说明当前待办，若第一项是盘点则调用 stok_opname。调拨可一对多：用户提到多个门店时，必须在 destinations 中逐店填入数量；不要合并或猜测数量。门店名称必须换成对应编码：${stores}。不要虚构物料、数量、门店、照片或库存数据，不要执行或承诺已提交；所有操作都要由店员确认后才会提交。当前可选物料：${materials || '暂未加载物料'}。当前今日待办：${todayTasks.length ? todayTasks.map((task) => `${task.title}（${task.detail}）`).join('；') : '无'}。当前未完成草稿：${currentDraft ? JSON.stringify(currentDraft).slice(0, 800) : '无'}。` },
          ...history.slice(-8).map((turn) => ({ role: turn.role === 'assistant' ? 'assistant' : 'user', content: String(turn.content || '').slice(0, 600) })),
          { role: 'user', content: message }
        ],
        tools: r2StoreAgentTools(), tool_choice: 'auto'
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const choice = data?.choices?.[0]?.message || {};
    const call = choice.tool_calls?.[0];
    if (!call?.function?.name) return choice.content ? { reply: String(choice.content).slice(0, 500), action: { type: 'none' } } : null;
    let args = {};
    try { args = JSON.parse(call.function.arguments || '{}'); } catch (_) { return null; }
    const action = r2StoreAgentLlmAction(call.function.name, args, rows);
    if (!action) return null;
    return { reply: r2StoreAgentReplyForAction(action) || '我已识别你的操作，请补全信息后确认。', action };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function r2StoreAgentDeterministic(env, body) {
  const message = String(body.message || '').trim().slice(0, 600);
  const storeCode = String(body.store_code || body.storeId || STORE_CODE).trim().slice(0, 64) || STORE_CODE;
  const bootstrap = await r2StoreBootstrap(env, storeCode);
  const rows = bootstrap.ledger?.length ? bootstrap.ledger : (bootstrap.materialCatalog || []).map((item) => ({ material_name: item.material_name, unit: item.base_unit, theoretical_closing_qty: 0, safety_qty: null }));
  const todayTasks = r2StoreAgentTodayTasks(bootstrap, storeCode);
  const toolContract = {
    provider: env.DOUBAO_API_KEY ? 'ark_function_calling' : 'deterministic_demo',
    execution: 'draft_only',
    tools: ['lapor_kerugian', 'transfer_stok', 'stok_opname', 'create_purchase_order_draft', 'create_receipt_order_draft', 'query_inventory']
  };
  if (!message || message === '__welcome__') {
    return json({
      reply: r2StoreAgentTodayTaskReply(storeCode, todayTasks),
      action: { type: 'none' }, today_tasks: todayTasks, tool_contract: toolContract
    });
  }
  const number = r2StoreAgentNumber(message);
  const matchedMaterials = r2StoreAgentMaterials(rows, message);
  const material = matchedMaterials[0] || null;
  const currentDraft = r2StoreAgentDraft(body);
  const lower = message.toLowerCase();
  if (/今日待办|今天.*待办|今天.*做什么|待办任务|帮我.*待办/.test(lower)) {
    return json({ reply: r2StoreAgentTodayTaskReply(storeCode, todayTasks), action: { type: 'none' }, today_tasks: todayTasks, tool_contract: toolContract });
  }
  if (/库存|余量|还有多少|查.*(物料|库存)|查询|inventory|stock|stok|cek stok|berapa.*stok/.test(lower)) {
    if (!matchedMaterials.length) return json({ reply: '请告诉我要查询的物料，例如“查牛奶和黑糖珍珠库存”。', action: { type: 'none' }, tool_contract: toolContract });
    const items = matchedMaterials.map((item) => ({ material_name:item.material_name, unit:item.unit, theoretical_closing_qty:Number(item.theoretical_closing_qty || 0), safety_qty:item.safety_qty ?? null }));
    return json({
      reply: items.map((item) => `${item.material_name}：当前理论库存 ${r2Round(item.theoretical_closing_qty)} ${item.unit}${item.safety_qty != null ? `，安全库存 ${r2Round(item.safety_qty)} ${item.unit}` : ''}`).join('\n'),
      action: { type: 'show_inventory', data: { ...items[0], items } },
      tool_contract: toolContract
    });
  }
  // 门店口语经常省略“拨”，例如“调 2kg 黑糖珍珠去 STORE002”。
  if (currentDraft?.intent === 'transfer' || /调拨|调出|转给|转到|调\s*\d|调.*?(?:去|到|至)|transfer|move .* to|pindah|pindahkan|kirim .* store/.test(lower)) {
    const prior = currentDraft?.intent === 'transfer' ? currentDraft.values || {} : {};
    const priorDestinations = Array.isArray(prior.destinations) ? prior.destinations.filter((item) => item?.store_code || item?.qty) : [];
    const transferMaterial = material || r2StoreAgentMaterial(rows, prior.material_name || '');
    const normalizedQuantity = number.qty ? r2StoreAgentBaseQuantity(transferMaterial, number.qty, number.unit) : { qty: Number(prior.qty) > 0 ? Number(prior.qty) : '', unit: transferMaterial?.unit || prior.unit || '' };
    const transferQty = normalizedQuantity.qty;
    const toStore = r2StoreAgentDestination(message) || prior.to_store_code || priorDestinations[0]?.store_code || null;
    const destinations = priorDestinations.length ? priorDestinations.map((item) => ({ store_code: item.store_code, qty: Number(item.qty) > 0 ? Number(item.qty) : transferQty || '' })) : (toStore ? [{ store_code: toStore, qty: transferQty || '' }] : []);
    const missing = [!transferMaterial && '物料', !transferQty && '数量', !toStore && '调入门店'].filter(Boolean);
    const prefill = { material_name: transferMaterial?.material_name || '', unit: normalizedQuantity.unit, qty: transferQty, to_store_code: toStore || '', destinations };
    return json({
      reply: missing.length ? `我识别到你要发起调拨，还缺少：${missing.join('、')}。我已打开调拨单，请补全后确认提交。` : `已识别调拨草稿：${transferMaterial.material_name} ${transferQty} ${prefill.unit} 调往 ${toStore}。请在表单中确认后提交。`,
      action: { type: 'open_transfer', prefill }, tool_contract: toolContract
    });
  }
  if (currentDraft?.intent === 'scrap' || /报损|报废|损耗|过期|破损|变质|烂了|坏了|洒|漏|scrap|waste|damaged|expired|lapor.*rusak|barang.*rusak|kedaluwarsa|kadaluarsa|basi|tumpah/.test(lower)) {
    const prior = currentDraft?.intent === 'scrap' ? currentDraft.values || {} : {};
    const scrapMaterial = material || r2StoreAgentMaterial(rows, prior.material_name || '');
    const normalizedQuantity = number.qty ? r2StoreAgentBaseQuantity(scrapMaterial, number.qty, number.unit) : { qty: Number(prior.qty) > 0 ? Number(prior.qty) : '', unit: scrapMaterial?.unit || prior.unit || '' };
    const scrapQty = normalizedQuantity.qty;
    const reason = r2StoreAgentReason(message) || prior.reason || '';
    const missing = [!scrapMaterial && '物料', !scrapQty && '数量', !reason && '报损原因'].filter(Boolean);
    return json({
      reply: missing.length ? `我识别到报损登记，还缺少：${missing.join('、')}。请补全后确认。` : `已识别报损草稿：${scrapMaterial.material_name} ${scrapQty} ${scrapMaterial.unit}，原因：${reason}。请确认后提交，照片可选。`,
      action: { type: 'open_scrap', prefill: { material_name: scrapMaterial?.material_name || '', unit: normalizedQuantity.unit, qty: scrapQty, reason } }, tool_contract: toolContract
    });
  }
  if (currentDraft?.intent === 'count' || /盘点|盘库|清点|count inventory|stock count|inventory count|stok opname|hitung stok/.test(lower)) {
    return json({
      reply: material ? `我会为你打开 ${material.material_name} 的盘点入口；请拍照识别后确认异常项。` : '我已打开今日盘点单。拍照后系统会先识别，只需确认未识别或异常项目。',
      action: { type: 'open_count', prefill: { material_name: material?.material_name || '' } }, tool_contract: toolContract
    });
  }
  if (currentDraft?.intent === 'receipt' || /收货|入库|到货|receive|received|goods receipt|penerimaan|terima barang/.test(lower)) {
    const prior = currentDraft?.intent === 'receipt' ? currentDraft.values || {} : {};
    const receiptMaterial = material || r2StoreAgentMaterial(rows, prior.material_name || '');
    const normalizedQuantity = number.qty ? r2StoreAgentBaseQuantity(receiptMaterial, number.qty, number.unit) : { qty: Number(prior.qty) > 0 ? Number(prior.qty) : '', unit: receiptMaterial?.unit || prior.unit || '' };
    const receiptQty = normalizedQuantity.qty;
    const missing = [!receiptMaterial && '物料', !receiptQty && '数量'].filter(Boolean);
    return json({ reply: missing.length ? `我识别到收货入库，还缺少：${missing.join('、')}。请补全后确认。` : `已识别收货草稿：${receiptMaterial.material_name} ${receiptQty} ${normalizedQuantity.unit}。请确认后提交，照片可选。`, action: { type: 'open_receipt', prefill: { material_name: receiptMaterial?.material_name || '', unit: normalizedQuantity.unit, qty: receiptQty } }, tool_contract: toolContract });
  }
  if (currentDraft?.intent === 'restock' || /订货|下单|补货|缺货|库存不足|要货|purchase order|place an order|restock|replenish|out of stock|pesan barang|buat pesanan|isi ulang stok|tambah stok|stok kurang/.test(lower)) {
    const missing = [!material && '物料', !number.qty && '数量', !/库存不足|促销|备货|缺货|断货/.test(message) && '申请原因'].filter(Boolean);
    const reason = /促销|备货/.test(message) ? '促销备货' : /库存不足|缺货|断货/.test(message) ? '库存不足' : '';
    return json({ reply: missing.length ? `我识别到补货申请，还缺少：${missing.join('、')}。` : `已识别补货申请：${material.material_name} ${number.qty}${material.unit}，请确认后提交给总部。`, action: { type: 'open_restock', prefill: { material_name: material?.material_name || '', unit: material?.unit || number.unit || '', qty: number.qty || '', urgency: /紧急|马上/.test(message) ? 'urgent' : 'normal', reason } }, tool_contract: toolContract });
  }
  return json({ reply: '我可以处理调拨、报损、盘点、订货、收货和查询库存。例如：“订货 5L 牛奶”或“收到 2kg 黑糖珍珠”。', action: { type: 'none' }, tool_contract: toolContract });
}

function r2StoreAgentSession(value, storeCode, rawSessionId) {
  const sessionId = /^[A-Za-z0-9_-]{8,80}$/.test(String(rawSessionId || '')) ? String(rawSessionId) : `web-${crypto.randomUUID()}`;
  let session = (value.storeAgentSessions || []).find((item) => item.id === sessionId && item.store_code === storeCode);
  if (!session) {
    session = { id: sessionId, store_code: storeCode, messages: [], draft: null, created_at: now(), updated_at: now() };
    value.storeAgentSessions.unshift(session);
  }
  session.messages = Array.isArray(session.messages) ? session.messages.slice(-12) : [];
  return session;
}

function r2StoreAgentDraft(body) {
  const input = body?.draft;
  if (!input || typeof input !== 'object' || !['transfer', 'scrap', 'receipt', 'count', 'restock'].includes(input.intent)) return null;
  const values = input.values && typeof input.values === 'object' ? input.values : {};
  const destinations = Array.isArray(values.destinations) ? values.destinations.map((item) => ({ store_code: String(item?.store_code || '').slice(0, 64), qty: Number(item?.qty) > 0 ? Number(item.qty) : '' })).filter((item) => item.store_code || item.qty).slice(0, 8) : [];
  return { intent: input.intent, values: { material_name: String(values.material_name || '').slice(0, 80), unit: String(values.unit || '').slice(0, 12), qty: Number(values.qty) > 0 ? Number(values.qty) : '', to_store_code: String(values.to_store_code || '').slice(0, 64), destinations, reason: String(values.reason || '').slice(0, 160), urgency: String(values.urgency || 'normal').slice(0, 16), plan_no: String(values.plan_no || '').slice(0, 120), request_id: String(values.request_id || '').slice(0, 120) } };
}

async function r2StoreAgent(env, body) {
  const message = String(body.message || '').trim().slice(0, 600);
  if (!message || message === '__welcome__') return r2StoreAgentDeterministic(env, body);
  const storeCode = String(body.store_code || body.storeId || STORE_CODE).trim().slice(0, 64) || STORE_CODE;
  const bootstrap = await r2StoreBootstrap(env, storeCode);
  const value = await r2DemoState(env);
  const session = r2StoreAgentSession(value, storeCode, body.session_id);
  const draft = r2StoreAgentDraft(body) || session.draft;
  const history = session.messages.slice(-8);
  session.messages.push({ role: 'user', content: message, at: now() });
  const todayTasks = r2StoreAgentTodayTasks(bootstrap, storeCode);
  const assistantRows = bootstrap.ledger?.length ? bootstrap.ledger : (bootstrap.materialCatalog || []).map((item) => ({ material_name: item.material_name, unit: item.base_unit, theoretical_closing_qty: 0, safety_qty: null }));
  const llmResult = await r2StoreAgentWithArk(env, message, storeCode, assistantRows, history, draft, todayTasks);
  const requestedOperation = /调拨|调出|转给|转到|调\s*\d|调.*?(?:去|到|至)|报损|报废|损耗|过期|破损|变质|烂了|坏了|洒|漏|盘点|盘库|清点|收货|入库|到货|补货|缺货|库存不足|要货|库存|余量|还有多少|查询|transfer|move .* to|pindah|pindahkan|scrap|waste|damaged|expired|rusak|kedaluwarsa|kadaluarsa|stock count|inventory count|stok opname|receive|goods receipt|penerimaan|terima barang|restock|replenish|isi ulang stok|tambah stok|inventory|stock|stok/.test(message.toLowerCase());
  if (llmResult && (llmResult.action?.type !== 'none' || !requestedOperation)) {
    const resolved = r2StoreAgentMergeActionDraft(llmResult.action, draft);
    const result = { ...llmResult, action: resolved.action };
    session.draft = resolved.draft;
    session.messages.push({ role: 'assistant', content: result.reply, at: now() });
    session.updated_at = now();
    await r2SaveDemoState(env, value, 'store-agent-memory');
    return json({
      ...result,
      memory: { session_id: session.id, stored_turns: session.messages.length },
      tool_contract: { provider: 'ark_function_calling', model: env.DOUBAO_MODEL || R2_ARK_STORE_AGENT_MODEL, execution: 'draft_only', tools: ['lapor_kerugian', 'transfer_stok', 'stok_opname', 'create_purchase_order_draft', 'create_receipt_order_draft', 'query_inventory'] }
    });
  }
  const fallback = await r2StoreAgentDeterministic(env, { ...body, draft });
  const fallbackPayload = await fallback.clone().json().catch(() => ({}));
  const resolvedFallback = r2StoreAgentMergeActionDraft(fallbackPayload.action, draft);
  session.draft = resolvedFallback.draft;
  session.messages.push({ role: 'assistant', content: String(fallbackPayload.reply || ''), at: now() });
  session.updated_at = now();
  await r2SaveDemoState(env, value, 'store-agent-memory');
  return json({ ...fallbackPayload, action: resolvedFallback.action, memory: { session_id: session.id, stored_turns: session.messages.length } }, fallback.status);
}

// AI 助手的照片只作为门店凭证保存；它不会擅自把一张照片解释成库存数量。
// 盘点实际数仍需由门店在盘点表确认，防止图像识别误读直接改写台账。
async function r2CreateStoreAgentEvidence(env, body = {}) {
  const value = await r2DemoState(env);
  const storeCode = String(body.store_code || STORE_CODE).trim().slice(0, 64) || STORE_CODE;
  const intent = ['scrap', 'count', 'receipt'].includes(body.intent) ? body.intent : null;
  const filename = String(body.filename || '').trim().slice(0, 160);
  if (!intent || !filename) return bad('请提供凭证类型和照片文件名。');
  const labels = { scrap: '报损', count: '盘点', receipt: '收货' };
  const documentType = intent === 'receipt' ? 'receipt' : intent === 'scrap' ? 'scrap' : 'inventory_count';
  const document = r2AddDocument(value, 'agent-photo', filename, [], `门店 AI 助手收到${labels[intent]}照片，等待门店确认${intent === 'count' ? '实际盘点数量' : '单据数据'}。`, documentType, validPreviewData(body.preview_data), { store_code: storeCode, business_date: value.feishuImport?.latest_business_date || chinaBusinessDate() });
  r2Audit(value, '门店 AI 助手', '提交照片凭证', `${storeCode} · ${labels[intent]} · ${filename}；照片已留档，未自动修改库存数量。`, document.id);
  return json({ document, state: await r2SaveDemoState(env, value, 'store-agent-evidence') }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/feishu/events' && request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
    }
    if (request.method === 'GET' && url.pathname === '/api/feishu/events') {
      const challenge = url.searchParams.get('challenge');
      return json(challenge ? { challenge } : { status: 'ready' });
    }
    if (request.method === 'POST' && url.pathname === '/api/feishu/events') return receiveFeishuEvent(request, env);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/feishu/alert-test') return r2SendFeishuAlertTest(env);
    if (env.DEMO_STATE && request.method === 'GET' && url.pathname === '/api/notifications/config') return r2NotificationConfig(env);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/notifications/config') return r2UpdateNotificationConfig(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/notifications/preview') return r2PreviewNotification(env, await request.json().catch(() => ({})));
    if (request.method === 'GET' && url.pathname === '/api/feishu-sync/state') {
      const value = env.DEMO_STATE ? await r2FeishuSyncState(env) : await feishuSyncState(env.DB);
      return json(env.DEMO_STATE ? r2FeishuStateView(value, url.searchParams.get('view') || '') : value);
    }
    if (env.DEMO_STATE && request.method === 'GET' && url.pathname === '/api/diagnosis-v2/shadow') {
      const state = await r2DemoState(env);
      const calculated = await r2FeishuSyncState(env);
      return json(buildDiagnosisShadowReport({ ...calculated, purchaseOrders:state.purchaseOrders || [], receiptOrders:state.receiptOrders || [], storeTransferRequests:state.storeTransferRequests || [] }, state.materialCatalog || []));
    }
    if (env.DEMO_STATE && request.method === 'GET' && url.pathname === '/api/store-masters') {
      const value = await r2DemoState(env);
      return json({ store_masters: value.storeMasters || r2DefaultStoreMasters() });
    }
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/store-masters/sync') return r2SyncStoreMasters(env);
    if (env.DEMO_STATE && request.method === 'GET' && url.pathname === '/api/product-catalog') {
      const value = await r2DemoState(env);
      return json({ product_catalog: value.productCatalog || r2DefaultProductCatalog() });
    }
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/product-catalog/sync') return r2SyncProductCatalog(env);
    if (env.DEMO_STATE && request.method === 'GET' && url.pathname === '/api/material-catalog') {
      const value = await r2DemoState(env);
      return json({ material_catalog: value.materialCatalog || r2DefaultMaterialCatalog() });
    }
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/material-catalog/sync') return r2SyncMaterialCatalog(env);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/material-catalog/count-policy') return r2UpdateMaterialCountPolicies(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'GET' && url.pathname === '/api/safety-stock-policies') {
      const value = await r2DemoState(env);
      return json({ safety_stock_policies: value.safetyStockPolicies || r2DefaultSafetyStockPolicies() });
    }
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/safety-stock-policies/sync') return r2SyncSafetyStockPolicies(env);
    if (env.DEMO_STATE && request.method === 'GET' && url.pathname === '/api/store/bootstrap') {
      const storeCode = String(url.searchParams.get('store') || STORE_CODE).trim().slice(0, 64) || STORE_CODE;
      return json(await r2StoreBootstrap(env, storeCode));
    }
    if (request.method === 'POST' && url.pathname === '/api/voice-transcribe') return transcribeVoice(request, env);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/store-agent') return r2StoreAgent(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/store-agent/evidence') return r2CreateStoreAgentEvidence(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/count-photo-recognition') return r2CreateCountPhotoReview(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/count-photo-recognition/confirm') return r2ConfirmCountPhotoReview(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'GET' && url.pathname === '/api/count-evidence') {
      const planNo = String(url.searchParams.get('plan_no') || '').trim().slice(0, 120);
      const documentId = String(url.searchParams.get('document_id') || '').trim().slice(0, 120);
      if (!planNo && !documentId) return bad('缺少盘点单号或盘点凭证编号。');
      const evidence = await r2CountEvidence(env, planNo, documentId);
      return evidence ? json(evidence) : bad('未找到对应的盘点单或盘点凭证。', 404);
    }
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/feishu-sync/refresh') {
      try { return json(await r2ImportFeishuSales(env, false, url.searchParams.get('force') === '1')); } catch (error) { return bad(error instanceof Error ? error.message : '飞书读取失败。', 502); }
    }
    if (request.method === 'POST' && url.pathname === '/api/internal/feishu-sync') {
      if (!env.FEISHU_SYNC_KEY || request.headers.get('X-Feishu-Sync-Key') !== env.FEISHU_SYNC_KEY) return bad('未授权的同步请求。', 401);
      if (!await hasD1Table(env.DB, 'demo_opening_inventory_counts') || !await hasD1Table(env.DB, 'material_inventory_anomalies')) return bad('库存台账迁移尚未完成，已暂停飞书批量写入以保护 D1 额度。', 503);
      return json(await syncFeishuSales(env.DB, env));
    }
    if (request.method === 'POST' && url.pathname === '/api/demo-sales/generate') {
      if (env.DEMO_STATE) return r2CreateDemoSales(env);
      try { return json(await createDemoSales(env.DB, env)); } catch (error) { return bad(error instanceof Error ? error.message : '生成演示销售失败。', 502); }
    }
    if (request.method === 'POST' && url.pathname === '/api/demo-sales/revert') {
      if (env.DEMO_STATE) return r2RevertDemoSales(env);
      try { return json(await revertDemoSales(env.DB, env)); } catch (error) { return bad(error instanceof Error ? error.message : '撤回演示销售失败。', 502); }
    }
    if (request.method === 'POST' && url.pathname === '/api/demo-opening-inventory/initialize') {
      if (env.DEMO_STATE) {
        try { return await r2InitializeDemoOpening(env); } catch (error) { return bad(error instanceof Error ? error.message : '建立演示首日盘点失败。', 502); }
      }
      try { return json(await initializeActiveDemoOpeningCounts(env.DB, env)); } catch (error) { return bad(error instanceof Error ? error.message : '建立演示首日盘点失败。', 502); }
    }
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/material-events') return r2CreateMaterialEvent(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/store-restock-requests') return r2CreateStoreRestockRequest(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/purchase-orders') return r2CreatePurchaseOrder(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'GET' && /^\/api\/purchase-orders\/[^/]+$/.test(url.pathname)) return r2ProcurementDetail(env, 'purchase', decodeURIComponent(url.pathname.split('/')[3]));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/purchase-orders/') && url.pathname.endsWith('/submit')) return r2PurchaseOrderAction(env, decodeURIComponent(url.pathname.split('/')[3]), 'submit');
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/purchase-orders/') && url.pathname.endsWith('/cancel')) return r2PurchaseOrderAction(env, decodeURIComponent(url.pathname.split('/')[3]), 'cancel');
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/receipt-orders') return r2CreateReceiptOrder(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'GET' && /^\/api\/receipt-orders\/[^/]+$/.test(url.pathname)) return r2ProcurementDetail(env, 'receipt', decodeURIComponent(url.pathname.split('/')[3]));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/receipt-orders/') && url.pathname.endsWith('/confirm')) return r2ReceiptOrderAction(env, decodeURIComponent(url.pathname.split('/')[3]), 'confirm', await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/receipt-orders/') && url.pathname.endsWith('/cancel')) return r2ReceiptOrderAction(env, decodeURIComponent(url.pathname.split('/')[3]), 'cancel', await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/material-transfers') return r2CreateMaterialTransfer(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/transfer-orders') return r2CreateTransferOrder(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/store-transfer-requests') return r2CreateStoreTransferRequest(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/store-transfer-requests/') && url.pathname.endsWith('/receive')) return r2ReceiveStoreTransferRequest(env, url.pathname.split('/')[3], await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/material-events/') && url.pathname.endsWith('/revert')) return r2RevertMaterialEvent(env, url.pathname.split('/')[3]);
    if (!env.DEMO_STATE && request.method === 'GET' && url.pathname === '/api/state') return json(await state(env.DB));
    if (request.method === 'GET' && url.pathname === '/api/demo-store/status') {
      if (!env.DEMO_STATE) return json({ provider: 'D1', mode: 'legacy', ready: false, message: 'R2 演示状态存储尚未绑定。' });
      const value = await r2DemoState(env);
      return json({ ...value.storage, ready: true, currentKey: R2_DEMO_CURRENT_KEY, initialKey: R2_DEMO_INITIAL_KEY });
    }
    if (request.method === 'GET' && url.pathname === '/api/system/storage-health') return r2StorageHealth(env);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/demo-day/reset') return r2ResetStoreBusinessDay(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/demo-day/initialize') return r2InitializeStoreBusinessDay(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/demo-day/run') return r2RunStoreDayDemo(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'GET' && url.pathname === '/api/state') return json(r2StateView(await r2DemoState(env), url.searchParams.get('view') || ''));
    if (env.DEMO_STATE && request.method === 'GET' && url.pathname === '/api/diagnosis-knowhow') {
      const value = await r2DemoState(env);
      return json({ knowhow: r2DiagnosisKnowhowList(value), storage: value.storage });
    }
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/diagnosis-knowhow') return r2SaveDiagnosisKnowhow(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/count-plans/generate') return r2GenerateDailyCountPlans(env);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/count-plans/manual') return r2CreateManualCountPlan(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/diagnosis-cases/') && url.pathname.endsWith('/auto-review')) return r2RunDiagnosisAutoReview(env, url.pathname.split('/')[3]);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/diagnosis-cases/') && url.pathname.endsWith('/request-evidence')) return r2CreateDiagnosisFollowup(env, url.pathname.split('/')[3], 'request_receipt_evidence');
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/diagnosis-cases/') && url.pathname.endsWith('/create-governance')) return r2CreateDiagnosisFollowup(env, url.pathname.split('/')[3], 'create_governance_task');
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/diagnosis-cases/') && url.pathname.endsWith('/dispatch-count')) return r2DispatchDiagnosisCount(env, url.pathname.split('/')[3]);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/diagnosis-cases/') && url.pathname.endsWith('/dispatch-remaining-count')) return r2DispatchRemainingDiagnosisCount(env, url.pathname.split('/')[3]);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/diagnosis-cases/') && url.pathname.endsWith('/dispatch-targeted-count')) return r2DispatchTargetedDiagnosisCount(env, url.pathname.split('/')[3], await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/diagnosis-cases/') && url.pathname.endsWith('/force-close')) return r2ForceCloseDiagnosisCase(env, url.pathname.split('/')[3], await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/diagnosis-cases/') && url.pathname.endsWith('/close')) return r2CloseDiagnosisCase(env, url.pathname.split('/')[3], await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/count-documents') {
      const body = await request.json().catch(() => ({}));
      return body.documentType && body.documentType !== 'inventory_count' ? r2CreateSupportingDocument(env, body) : body.stage === 'recheck' ? r2SubmitRecheck(env, body) : r2CreateInitialCount(env, body);
    }
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/tasks/') && url.pathname.endsWith('/close')) return r2TaskTransition(env, url.pathname.split('/')[3], 'close');
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/tasks/') && url.pathname.endsWith('/request-recount')) return r2TaskTransition(env, url.pathname.split('/')[3], 'request-recount');
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/tasks/') && url.pathname.endsWith('/end-audit')) return r2TaskTransition(env, url.pathname.split('/')[3], 'end-audit');
    if (env.DEMO_STATE && request.method === 'GET' && /^\/api\/operation-tasks\/[^/]+$/.test(url.pathname)) return r2OperationTaskDetail(env, decodeURIComponent(url.pathname.split('/')[3]));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/operation-tasks') return r2CreateOperationTask(env, await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/operation-tasks/') && url.pathname.endsWith('/notes')) return r2AddOperationTaskNote(env, url.pathname.split('/')[3], await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/operation-tasks/') && url.pathname.endsWith('/reassess')) return r2ReassessOperationTask(env, url.pathname.split('/')[3]);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/operation-tasks/') && url.pathname.endsWith('/submit')) return r2OperationTransition(env, url.pathname.split('/')[3], await request.json().catch(() => ({})), 'submit');
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/operation-tasks/') && url.pathname.endsWith('/close')) return r2OperationTransition(env, url.pathname.split('/')[3], {}, 'close');
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/governance-tasks') return r2Governance(env, null, await request.json().catch(() => ({})), 'create');
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/governance-tasks/') && url.pathname.endsWith('/close')) return r2Governance(env, url.pathname.split('/')[3], {}, 'close');
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/anomalies/') && url.pathname.endsWith('/work-order')) return r2CreateDiagnosisWorkOrder(env, url.pathname.split('/')[3]);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/anomalies/') && url.pathname.endsWith('/mvp-action')) return r2SetMvpDiagnosisAction(env, url.pathname.split('/')[3], await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname.startsWith('/api/anomalies/') && url.pathname.endsWith('/close')) return r2CloseAnomaly(env, url.pathname.split('/')[3], await request.json().catch(() => ({})));
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/demo/reset') return r2ResetDemo(env);
    if (env.DEMO_STATE && request.method === 'POST' && url.pathname === '/api/demo/cleanup-legacy-synthetic') return r2CleanupLegacySyntheticAnomalies(env);
    if (request.method === 'POST' && url.pathname === '/api/count-documents') {
      const body = await request.json().catch(() => ({}));
      if (body.documentType && body.documentType !== 'inventory_count') return createSupportingDocument(env.DB, body);
      return body.stage === 'recheck' ? submitRecheck(env.DB, body, env) : createInitialCount(env.DB, body, env);
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/tasks/') && url.pathname.endsWith('/close')) {
      return closeTask(env.DB, url.pathname.split('/')[3], env);
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/tasks/') && url.pathname.endsWith('/request-recount')) {
      return requestRecount(env.DB, url.pathname.split('/')[3], env);
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/tasks/') && url.pathname.endsWith('/end-audit')) {
      return endAudit(env.DB, url.pathname.split('/')[3], env);
    }
    if (request.method === 'POST' && url.pathname === '/api/operation-tasks') {
      const body = await request.json().catch(() => ({}));
      return createOperationTask(env.DB, body);
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/operation-tasks/') && url.pathname.endsWith('/submit')) {
      const body = await request.json().catch(() => ({}));
      return submitOperationTask(env.DB, url.pathname.split('/')[3], body, env);
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/operation-tasks/') && url.pathname.endsWith('/close')) {
      return closeOperationTask(env.DB, url.pathname.split('/')[3], env);
    }
    if (request.method === 'POST' && url.pathname === '/api/governance-tasks') {
      const body = await request.json().catch(() => ({}));
      return createGovernanceTask(env.DB, body);
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/governance-tasks/') && url.pathname.endsWith('/close')) {
      return closeGovernanceTask(env.DB, url.pathname.split('/')[3]);
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/anomalies/') && url.pathname.endsWith('/close')) {
      const body = await request.json().catch(() => ({}));
      return closeAnomalyAsMisclassification(env.DB, url.pathname.split('/')[3], body);
    }
    if (request.method === 'POST' && url.pathname === '/api/demo/reset') return resetDemo(env.DB, env);
    return bad('接口不存在。', 404);
  },
  async scheduled(controller, env, ctx) {
    if (env.DEMO_STATE) {
      ctx.waitUntil(Promise.allSettled([
        r2ImportFeishuSales(env, true).catch((error) => console.error('R2 Feishu import failed', error instanceof Error ? error.message : String(error))),
        syncFeishuProjectDocument(env).catch((error) => console.error('Feishu project document sync failed', error instanceof Error ? error.message : String(error))),
        syncFeishuProjectFiles(env).catch((error) => console.error('Feishu project deliverable sync failed', error instanceof Error ? error.message : String(error)))
      ]));
      return;
    }
    if (!await hasD1Table(env.DB, 'demo_opening_inventory_counts') || !await hasD1Table(env.DB, 'material_inventory_anomalies')) {
      console.warn('Skipping Feishu sync until inventory-ledger migrations are available.');
      return;
    }
    ctx.waitUntil(syncFeishuSales(env.DB, env));
  }
};

// Named exports are intentionally limited to deterministic diagnosis helpers.
// They let characterization tests lock the existing V1 behavior before the
// V2 decision engine is introduced, without exposing new HTTP capabilities.
export { r2DiagnosisWorkOrderCopy, r2ReconcileMaterialDiagnosis };
