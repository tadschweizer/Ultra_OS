import { useCallback, useEffect, useRef, useState } from 'react';

export default function useWorkoutLibrary({request,enabled}) {
  const [library,setLibrary]=useState([]),[loaded,setLoaded]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const current=useRef(null),version=useRef(0);
  const reload=useCallback(async()=>{
    if(!enabled||current.current)return;
    const generation=version.current,controller=new AbortController();current.current=controller;setLoading(true);
    const timer=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await request('/api/workout-library',{signal:controller.signal});
      const data=await response.json();
      if(!response.ok||!Array.isArray(data.workouts))throw new Error('Library load failed.');
      if(generation===version.current){setLibrary(data.workouts);setLoaded(true);setError('');}
    }catch{
      if(generation===version.current)setError('Workout library could not be loaded. Retry when the connection or service is restored.');
    }finally{
      clearTimeout(timer);
      if(generation===version.current){current.current=null;setLoading(false);}
    }
  },[request,enabled]);
  useEffect(()=>{
    setLibrary([]);setLoaded(false);setError('');reload();
    return()=>{version.current++;current.current?.abort();current.current=null;};
  },[reload]);
  return {library,setLibrary,loaded,loading,error,reload};
}
