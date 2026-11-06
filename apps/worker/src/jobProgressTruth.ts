/** Runtime-verifiable Job progress for read-only research. The planner may
 * propose steps for guidance but cannot mark named Worker activity complete. */
export function researchStageLabels(hasSupportingWorkers:boolean):string[]{
  return hasSupportingWorkers
    ? ['Plan route','Gather source evidence','Independent specialist research','Lead synthesis','Validate research coverage']
    : ['Plan route','Gather source evidence','Lead Worker research and synthesis','Validate research coverage'];
}

export function collaborationHasGaps(args:{expected:number;completed:number;skipped:number;failed:number}):boolean{
  return args.expected>0 && (args.completed!==args.expected || args.skipped>0 || args.failed>0);
}

/** Specialist stage is marked independently by the specialist runtime after
 * checking its persisted outputs. Only successful phases are completed. */
export function finalResearchStageIds(hasSupportingWorkers:boolean):string[]{
  return hasSupportingWorkers
    ? ['stage_4','stage_5']
    : ['stage_3','stage_4'];
}
