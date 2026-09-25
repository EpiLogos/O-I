import {registeredHostedSurfaces} from "./generated";
import type {SurfacePresentationBinding} from "../surface/types";
import type {RegisteredHostedSurface} from "./contracts";

/** A restore may name a contribution no longer compiled into this candidate.
 * Retain its binding and show unavailable; never substitute another owner. */
export function hostedSurfaceFor(binding: Pick<SurfacePresentationBinding, "kind" | "hosted">, registry: readonly RegisteredHostedSurface[] = registeredHostedSurfaces): RegisteredHostedSurface | undefined {
  return registry.find(({descriptor}) => descriptor.kind === binding.kind && (!binding.hosted || (
    descriptor.descriptor_ref === binding.hosted.descriptor_ref && descriptor.contribution_ref === binding.hosted.contribution_ref
  )));
}

export function withHostedDescriptor<T extends SurfacePresentationBinding>(binding: T): T {
  const descriptor = hostedSurfaceFor(binding)?.descriptor;
  return descriptor && !binding.hosted ? {...binding, hosted:{descriptor_ref:descriptor.descriptor_ref, contribution_ref:descriptor.contribution_ref}} : binding;
}
