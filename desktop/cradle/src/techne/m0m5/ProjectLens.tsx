/**
 * The M0′ Project lens body (T3, 2026-09-19) — WikiExpressionBody re-hosted
 * as the ground lens of the Technē mode. NO rewrite: the real Wiki→Expression
 * projection (overview scene, constellations as addressable objects,
 * constellation scenes, the kernel-held oi.expression/v1 document) stands
 * exactly as built; this wrapper only adds the lens mount duties — the four
 * disclosure states (§21) from the subject's TechneDisclosureState and the
 * Studio slot carrying the projection's standing while the lens is active.
 *
 * Availability is the reading's own disclosure entry for `project`
 * (instrumentStanding), never what happens to be mounted.
 */
import {useEffect, useRef} from "react";
import type {TechneLensBodyProps} from "../lensMount";
import {useWikiProjectionState} from "../wikiProjectionStore";
import {WikiExpressionBody} from "../WikiExpressionBody";
import {ensureSession, bridgeReading} from "./reading";

/** The M0′ Studio body: the wiki projection's standing — the store is the
 * ONE projection/selection state (QL-MEF #213 / O-I #366 EX3A); this panel
 * only reads it. */
function ProjectStudioPanel() {
  const store = useWikiProjectionState();
  const register = store.registers.find((row) => row.key === store.registerKey) ?? store.registers[0];
  const standing = register ? store.standings[register.key] : undefined;
  const phase = standing?.phase ?? "idle";
  const document = standing && (standing.phase === "ready" || standing.phase === "drift") ? standing.document : undefined;
  const projection = standing && "projection" in standing ? standing.projection : undefined;
  return (
    <div className="tn-m0m5-studio" data-instrument="project">
      <span className="tn-m0m5-studio-office">M0′ · Project · Wiki · Graph</span>
      <dl className="tn-m0m5-studio-facts">
        <dt>Register</dt><dd>{register?.title ?? "none disclosed"}</dd>
        <dt>Projection</dt><dd data-phase={phase}>{phase}</dd>
        {document && <><dt>Expression</dt><dd><code>{document.expression_ref}</code> @ rev {document.revision}</dd></>}
        {projection && <><dt>Typed relations</dt><dd>{projection.boundRelationCount} bound{projection.adriftRelationCount > 0 ? ` · ${projection.adriftRelationCount} outside this whole` : ""}</dd></>}
      </dl>
    </div>
  );
}

/** Ground navigation and the Epii entrance are available before a subject or
 * optional QL reading. The instrument disclosure still governs operations
 * which need those facets; it must not gate the owner's entrance itself. */
export function ProjectLensBody(props: TechneLensBodyProps) {
  const {binding, subject, disclosure, studio} = props;
  return <ProjectMount studio={studio} binding={binding} subject={subject} disclosure={disclosure}/>;
}

function ProjectMount(props: {studio: TechneLensBodyProps["studio"]; binding: TechneLensBodyProps["binding"]; subject: TechneLensBodyProps["subject"]; disclosure: TechneLensBodyProps["disclosure"]}) {
  const {studio, binding, subject, disclosure} = props;
  // The one session: the ground lens opens it for the arrangement's subject
  // on the project instrument — the same basis every other lens re-projects.
  // Alignment is an effect: a store write during render warns and can
  // cascade (found live in the integrated surface, 2026-09-19).
  const reading = bridgeReading(disclosure);
  const aligned = useRef<string | null>(null);
  const basisKey = reading ? `${reading.subject.subject_ref}|${reading.reading_ref}` : null;
  useEffect(() => {
    if (!reading || !basisKey) return;
    if (aligned.current !== basisKey) {
      ensureSession(reading, "project");
      aligned.current = basisKey;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basisKey]);
  // The Studio panel subscribes to the wiki projection store itself (the ONE
  // projection/selection state); the projection body is a real kernel actor
  // over its own document, and its selections are kernel focus edits — never
  // re-keyed here.
  const studioRef = useRef(studio);
  studioRef.current = studio;
  useEffect(() => {
    studioRef.current.setBody(<ProjectStudioPanel/>);
    studioRef.current.setTools(
      <span className="tn-m0m5-tool-chip" data-instrument="project">M0′</span>,
    );
    return () => {
      studioRef.current.setBody(null);
      studioRef.current.setTools(null);
    };
  }, []);
  return <WikiExpressionBody binding={binding} subject={subject}/>;
}
