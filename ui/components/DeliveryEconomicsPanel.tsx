"use client";

type DeliveryEconomicsPanelProps = {
  economics: {
    totalCostUsd: number;
    costPerAcceptedDelivery: number;
  };
};

export function DeliveryEconomicsPanel({ economics }: DeliveryEconomicsPanelProps) {
  return (
    <div className="rounded border border-sky-500/20 bg-sky-500/5 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">Delivery Economics</div>
      <div className="space-y-1 text-sm text-sky-50">
        <div>{`Total Cost $${economics.totalCostUsd.toFixed(2)}`}</div>
        <div>{`Cost per Accepted Delivery $${economics.costPerAcceptedDelivery.toFixed(2)}`}</div>
      </div>
    </div>
  );
}
