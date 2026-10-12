# PublicEdge Headlamp plugin

Read-only topology console for PublicEdgeManager. It shows public candidates,
area/region, capacity, health, selected ExternalDNS target, Gateway listener and
backend Service for every public hostname. It never patches DNS or routing.

The plugin requires read access to `PublicEdge`, `HTTPRoute`, `Ingress`, `Pod`
`Service` and `EndpointSlice` resources.

## External endpoint query

Select a published hostname to inspect the live control-plane path from its
ExternalDNS/PublicEdge authority through the Gateway listener and ClusterIP
Service to ready EndpointSlice addresses and their Pod nodes. The query panel
reports Gateway API `Accepted` and `ResolvedRefs` conditions separately from
backend readiness.

This is a Kubernetes control-plane snapshot, not an HTTP traffic trace. It does
not claim an external status code, latency or response body unless a separate
probe or request-telemetry source is added later.
