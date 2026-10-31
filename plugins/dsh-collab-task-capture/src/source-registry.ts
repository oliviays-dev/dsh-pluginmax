import type {
  TaskCaptureSourceAdapter,
  TaskCaptureSourceRef,
} from "@pluginmax/contracts";

export class TaskCaptureSourceRegistry {
  private readonly adapters = new Map<string, TaskCaptureSourceAdapter>();

  register(adapter: TaskCaptureSourceAdapter): () => void {
    const sourceType = adapter.sourceType.trim();
    if (sourceType === "") {
      throw new Error("task capture sourceType must not be empty");
    }
    const existing = this.adapters.get(sourceType);
    if (existing !== undefined && existing !== adapter) {
      throw new Error(
        `task capture source adapter already registered: ${sourceType}`,
      );
    }
    this.adapters.set(sourceType, adapter);
    return () => {
      if (this.adapters.get(sourceType) === adapter) {
        this.adapters.delete(sourceType);
      }
    };
  }

  resolve(source: TaskCaptureSourceRef): TaskCaptureSourceAdapter | undefined {
    return this.adapters.get(source.sourceType);
  }

  list(): readonly TaskCaptureSourceAdapter[] {
    return [...this.adapters.values()];
  }
}
