export type Ride = {
  id: string;
  pickup: string;
  destination: string;
  vehicle: string;
  paymentMethod: string;
  status: string;
  estimatedFare: string;
  createdAt: string;
  driverId?: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  etaMinutes?: number | null;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export function checkApiHealth() {
  return request<{ ok: boolean; service: string }>("/api/health");
}

export function subscribeToEvents(
  onEvent: (event: { type: string; data: unknown }) => void,
) {
  const source = new EventSource("/api/events");
  const eventTypes = ["connected", "ride.created", "ride.updated", "ride.accepted"];
  eventTypes.forEach((type) => {
    source.addEventListener(type, (message) => {
      const event = message as MessageEvent<string>;
      onEvent({ type, data: JSON.parse(event.data) });
    });
  });
  return () => source.close();
}

export function createRide(payload: {
  pickup: string;
  destination: string;
  vehicle: string;
  paymentMethod: string;
}) {
  return request<{ data: Ride }>("/api/rides", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
