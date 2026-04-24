import { RouteView } from "./RouteView";

export default async function RoutePage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  return <RouteView stationId={stationId} />;
}
