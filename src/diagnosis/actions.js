export const DIAGNOSIS_ACTIONS = Object.freeze({
  VIEW_PURCHASE: { action_id:'VIEW_PURCHASE', label:'查看订货与在途', mode:'link', route:'/purchase-orders/', requires_confirmation:false },
  VIEW_RECEIPTS: { action_id:'VIEW_RECEIPTS', label:'查看收货单', mode:'link', route:'/receipt-orders/', requires_confirmation:false },
  VIEW_TRANSFER: { action_id:'VIEW_TRANSFER', label:'查看调拨单', mode:'link', route:'/transfers/', requires_confirmation:false },
  VERIFY_DESTINATION_ACCEPTANCE: { action_id:'VERIFY_DESTINATION_ACCEPTANCE', label:'核对目标门店签收', mode:'manual', route:null, requires_confirmation:true },
  CREATE_SPOT_COUNT: { action_id:'CREATE_SPOT_COUNT', label:'下发单物料临时盘点', mode:'link', route:'/count-plans/?source=work_order', requires_confirmation:true },
  VIEW_FLOWS: { action_id:'VIEW_FLOWS', label:'查看相关库存流水', mode:'link', route:'/flows/', requires_confirmation:false },
  CREATE_RECEIPT_DRAFT: { action_id:'CREATE_RECEIPT_DRAFT', label:'建立收货补录草稿', mode:'draft', route:'/receipt-orders/#create', requires_confirmation:true },
  CREATE_RESTOCK_DRAFT: { action_id:'CREATE_RESTOCK_DRAFT', label:'建立紧急补货草稿', mode:'draft', route:'/purchase-orders/?urgency=urgent#create', requires_confirmation:true }
});

export function resolveDiagnosisActions(actionIds = []) {
  return actionIds.map((actionId) => DIAGNOSIS_ACTIONS[actionId]).filter(Boolean);
}
