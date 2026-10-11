import {createContext,useContext} from 'react'
import type {NativeInputContinuity} from './nativeInputs'
export interface NativeInputAperture {owner:NativeInputContinuity;current:()=>boolean;changed:()=>void;failure?:(key:string,reason:string|null)=>void;failures?:readonly string[]}
export const NativeInputRetentionContext=createContext<NativeInputAperture|null>(null)
export const useNativeInputRetention=()=>useContext(NativeInputRetentionContext)
