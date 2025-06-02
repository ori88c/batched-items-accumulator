<h2 align="middle">batched-items-accumulator</h2>

The `BatchedAccumulator` class is a lightweight utility for Node.js projects that accumulates items into fixed-size batches (number-of-items wise), preserving insertion order. It **streams items directly into batches during runtime:ocean:**, avoiding the overhead of post-processing a 1D array. This abstraction lets users focus on application logic without worrying about batch management.

Ideal for **delayed processing tasks** such as bulk write operations to databases, blob storage, and batched publishing of Kafka messages. Delayed execution helps optimize network efficiency by reducing the number of requests while increasing their size.

#### Example
Given a `BatchedAccumulator` instance with a batch size of 4, inserting the items `1, 2, 3, 4, 5, 6, 7` results in the following batches:
* [1, 2, 3, 4] (a full batch)
* [5, 6, 7] (a partial batch with the remaining items)

**Note:** If you need to group items into fixed-size batches **per key** - for example, Kafka messages **per topic** or MongoDB documents **per collection** - to accumulate them before periodic bulk publishing or writing, consider using the keyed version of this package for improved usability: [keyed-batched-items-accumulator](https://www.npmjs.com/package/keyed-batched-items-accumulator).

## Table of Contents

* [Key Features](#key-features)
* [API](#api)
* [Getter Methods](#getter-methods)
* [Use Case Example: Batch Upsert for MongoDB Documents](#use-case-example)
* [Design Decision: No Peeking](#no-peeking)
* [Breaking Change in Version 2.0.0](#breaking-change-2)
* [License](#license)

## Key Features :sparkles:<a id="key-features"></a>

* __Designed for Efficient Bulk Data Preparation :package:__: Applications often accumulate data from user interactions or message queues before persisting them in bulk to storage solutions like Amazon S3, Azure Blob Storage, or a database. To reduce network overhead, items are temporarily stored in memory and written in bulk, once a sufficient number has been collected or a timeout has been reached.
* __Streaming-Friendly Accumulation :ocean:__: Items are accumulated into batches **during runtime**, eliminating the need for a **post-processing** step that chunks a 1D array - a common approach in other packages. Post-processing chunking adds **O(n) time and space** complexity, which can degrade performance when batch processing is frequent or batch sizes are large. In contrast, this package’s `extractAccumulatedBatches` method operates in **O(1) time and space**, as items are stored in batches from the start.
* __Fixed-Size Batches :straight_ruler:__: The `push` method appends the item to the most recent batch if it has not yet reached the size threshold. Otherwise, it creates a new batch. Each batch contains the same number of items, except for the last batch, which may have fewer items.
* __Zero Overhead :dart:__: While simple in design, this class serves as a **building block** for more complex solutions. It abstracts batch management, allowing users to focus on their application logic while leveraging a well-tested, efficient batching mechanism.
- __State Metrics :bar_chart:__: The `batchesCount`, `isEmpty` and `accumulatedItemsCount` getters offer real-time insights into the accumulator's state, helping users make informed decisions, such as determining whether a minimum threshold of accumulated items has been reached before extracting batches.
- __Comprehensive documentation :books:__: Fully documented, enabling IDEs to provide intelligent **tooltips** for an enhanced development experience.
- __Thoroughly Tested :test_tube:__: Backed by extensive unit tests, to ensure reliability in production.
- __Zero Runtime Dependencies :dove:__: Only development dependencies are included.
- __ES2020 Compatibility__: The project targets ES2020 for modern JavaScript support.
- __Full TypeScript Support__: Designed for seamless TypeScript integration.

## API :globe_with_meridians:<a id="api"></a>

The `BatchedAccumulator` class provides the following methods:

* __push__: Adds an item to the accumulator, grouping it into a batch of fixed size. If the last batch is full or no batch exists, a new batch is created.
* __extractAccumulatedBatches__: Extracts and returns the accumulated batches as a 2D array, where each batch is a fixed-size array of items. The last batch may contain fewer elements if the total count is not a multiple of the batch size. Calling this method **transfers ownership** of the extracted batches to the caller, meaning the instance will **no longer retain them**. The accumulator is reset, clearing its internal storage to begin a new accumulation cycle.

If needed, refer to the code documentation for a more comprehensive description of each method.

## Getter Methods :mag:<a id="getter-methods"></a>

The `BatchedAccumulator` class provides the following getter methods to reflect the current state:

* __batchesCount__: Returns the number of batches currently held by this instance.
* __isEmpty__: Indicates whether this instance has accumulated any items.
* __accumulatedItemsCount__: Returns the total number of accumulated items across all batches. For example, if there are 5 full batches and the batch size is 100, the output will be 500. This method is useful for determining whether a minimum threshold of accumulated items has been reached before extracting batches, helping to avoid excessively small bulk operations.

## Use Case Example: Batch Upsert for MongoDB Documents :package:<a id="use-case-example"></a>

In many applications, MongoDB documents originate from sources such as message queues or user interactions. Instead of upserting each document individually - potentially causing excessive network load - it is common to **accumulate** them in memory before performing a periodic batch flush to the database.

To account for real-life complexities, this example triggers a batch flush when either of the following conditions is met:
* The number of accumulated documents exceeds a predefined threshold.
* The time since the last flush exceeds a specified maximum interval.

This example leverages the [non-overlapping-recurring-task](https://www.npmjs.com/package/non-overlapping-recurring-task) package to ensure that multiple batches are not upserted concurrently, helping to keep network bandwidth usage under control.
```ts
import { BatchedAccumulator } from 'batched-items-accumulator';
import {
  NonOverlappingRecurringTask,
  INonOverlappingRecurringTaskOptions
} from 'non-overlapping-recurring-task';
import { Collection, MongoError } from 'mongodb';

const FLUSH_INTERVAL_MS = 5000;
const BATCH_SIZE = 512;
const MIN_BATCH_SIZE_BEFORE_FLUSH = 64;
const MAX_FLUSH_INTERVAL_MS = 60 * 1000;

class PeriodicDocumentFlusher<DocumentType> {
  private readonly _documentsAccumulator = new BatchedAccumulator<DocumentType>(BATCH_SIZE);
  private readonly _recurringFlush: NonOverlappingRecurringTask<MongoError>;

  private _lastFlushTimestamp: number = 0;

  /**
   * Injects a collection and a logger instance.  
   * Context-aware child loggers are commonly used,  
   * especially in Nest.js apps (e.g., pino-http). 
   */
  constructor(
    private readonly _collection: Collection<DocumentType>,
    private readonly _logger: ILogger
  ) {
    const recurringFlushOptions: INonOverlappingRecurringTaskOptions = {
      intervalMs: FLUSH_INTERVAL_MS,
      immediateFirstRun: false
    };
    const forceFlush = false;
    this._recurringFlush = new NonOverlappingRecurringTask<MongoError>(
      () => this._flushAccumulatedBatches(forceFlush),
      recurringFlushOptions,
      this._onUpsertError.bind(this)
    );
  }

  public async start(): Promise<void> {
    // Initialize with the current timestamp to mark the start of the process.
    this._lastFlushTimestamp = Date.now();
    await this._recurringFlush.start();
  }
  
  public async stop(): Promise<void> {
    await this._recurringFlush.stop();
    const forceFlush = true;
    await this._flushAccumulatedBatches(forceFlush);
  }

  public add(doc: DocumentType): void {
    // Accumulate documents in memory for batch processing.
    this._documentsAccumulator.push(doc);
  }

  private async _bulkUpsert(batch: DocumentType[]): Promise<void> {
    // Implementation: Upsert a batch of accumulated documents into MongoDB.
  }

  private get _elapsedTimeSinceLastFlushMs(): number {
    return Date.now() - this._lastFlushTimestamp;
  }

  /**
   * Extracts accumulated document batches and upserts them sequentially.  
   * A production-ready implementation may include per-batch error handling
   * or retries mechanism.
   */
  private async _flushAccumulatedBatches(forceFlush: boolean): Promise<void> {
    const shouldSkip =
      !forceFlush &&
      this._documentsAccumulator.accumulatedItemsCount < MIN_BATCH_SIZE_BEFORE_FLUSH &&
      this._elapsedTimeSinceLastFlushMs < MAX_FLUSH_INTERVAL_MS;
    if (shouldSkip || this._documentsAccumulator.isEmpty) {
      return;
    }

    this._lastFlushTimestamp = Date.now();
    const batches: DocumentType[][] = this._documentsAccumulator.extractAccumulatedBatches();
    for (const batch of batches) {
      await this._bulkUpsert(batch);
    }
  }

  private _onUpsertError(error: MongoError): void {
    this._logger.error(
      `Batch upload failed due to MongoDB error code ${error?.code}: ${error.message}`
    );
  }
}
```

## Design Decision: No Peeking :see_no_evil:<a id="no-peeking"></a>

To maintain integrity, the class **does not provide direct access** to accumulated items or batches. Exposing internal references could allow unintended modifications, such as appending items to a full batch. Instead, the `extractAccumulatedBatches` method **transfers ownership** of all batches to the caller while resetting the instance to a clean state. This ensures the component's guarantees remain intact and prevents accidental modifications of extracted batches.

However, while direct peeking is not possible, users can utilize the getter methods `batchesCount`, `isEmpty`, and `accumulatedItemsCount` to assess whether extraction is needed.

## Breaking Change in Version 2.0.0 :warning:<a id="breaking-change-2"></a>

Method `accumulateItem` has been renamed to `push` to improve fluency and readability.

## License :scroll:<a id="license"></a>

[Apache 2.0](LICENSE)
