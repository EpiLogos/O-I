import {Component,type ReactNode} from 'react';
import type {InstrumentPresentation} from './presentation';
/** A malformed retained input must stay recoverable and must not take the
 * host shell down. No automatic discard or native replay occurs here. */
export class EditorFailureBoundary extends Component<{name:string;presentation:InstrumentPresentation;children:ReactNode},{error?:string}>{
 state:{error?:string}={};
 static getDerivedStateFromError(error:unknown){return {error:error instanceof Error?error.message:String(error)};}
 render(){return this.state.error?<section role="alert" className="instrument-notice"><strong>{this.props.name} could not open its retained editor.</strong><p>{this.state.error}</p><details><summary>Retained input and source basis</summary><pre>{JSON.stringify(this.props.presentation.checkpoint(),null,2)}</pre></details></section>:this.props.children;}
}
