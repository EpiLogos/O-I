import './ai-stack-aperture.css';

const OI = 'O:I';

const guideHref =
  'https://github.com/EpiLogos/O-I/blob/agent/ql-relational-field/docs/AI-ENGINEERING-FIELD-GUIDE.md';

export function AIStackAperture() {
  return (
    <aside className="stack-aperture" aria-labelledby="stack-aperture-title">
      <div className="stack-aperture__intro">
        <div>
          <div className="stack-aperture__eyebrow">Why this field is needed</div>
          <h2 id="stack-aperture-title">Agency engineering is becoming a discipline in its own right.</h2>
        </div>
        <div className="stack-aperture__copy">
          <p>
            Most of the engineering that determines what an AI can actually do happens outside the model. The loop, context,
            tools, memory, development process, execution environment and shared relations all shape the act. {OI} treats
            that surrounding field as a first-class design object.
          </p>
          <p>
            The endeavour is not to build another agent framework. It is to make the structure around agency legible,
            composable and inspectable by humans and agents alike — so that changing the world around the model becomes as
            deliberate as changing the model itself.
          </p>
          <a className="link-arrow" href={guideHref} target="_blank" rel="noreferrer">
            Read the AI engineering field guide
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </aside>
  );
}
