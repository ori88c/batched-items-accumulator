/**
 * Copyright 2025 Ori Cohen https://github.com/ori88c
 * https://github.com/ori88c/batched-items-accumulator
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * The `BatchedAccumulator` class facilitates accumulating items into fixed-size
 * batches, commonly used for delayed post-processing tasks such as bulk-write
 * operations to a database or blob storage. Each batch is an array of `ItemType`
 * items, preserving the original insertion order.
 *
 * ### Example
 * Given a `BatchedAccumulator` instance with a batch size of 4, inserting the
 * items 1, 2, 3, 4, 5, 6, 7 results in the following batches:
 * - [1, 2, 3, 4] (a full batch)
 * - [5, 6, 7] (a partial batch with the remaining items)
 *
 * ### Purpose
 * While simple in design, this class serves as a **building block** for more complex
 * solutions. It abstracts batch management, allowing users to focus on their application
 * logic while leveraging a well-tested, efficient batching mechanism.
 *
 * ### Typical Use Case
 * Applications often accumulate data from user interactions or message queues before
 * persisting them in bulk to storage solutions like Amazon S3, Azure Blob Storage, or
 * a database.
 * To reduce network overhead, items are temporarily stored in memory and written in
 * bulk, once a sufficient number has been collected or a timeout has been reached.
 * A corresponding example is available in this package's README.
 *
 * ### Design Decision: No Peeking (`extractAccumulatedBatches`)
 * To maintain integrity, the class **does not provide direct access** to accumulated
 * items or batches. Exposing internal references could allow unintended modifications,
 * such as appending items to a full batch.
 * Instead, the `extractAccumulatedBatches` method **transfers ownership** of all batches
 * to the caller while resetting the instance to a clean state. This ensures the component's
 * guarantees remain intact and prevents accidental modifications of extracted batches.
 * However, while direct peeking is not possible, users can utilize the getter methods
 * `batchesCount`, `isEmpty`, and `accumulatedItemsCount` to assess whether extraction is
 * needed.
 */
export class BatchedAccumulator<ItemType> {
  /**
   * Stores accumulated items as an array of batches,
   * where each batch is an array of `ItemType` items.
   */
  private _batches: ItemType[][] = [];

  constructor(private readonly _batchSize: number) {
    if (!isNaturalNumber(this._batchSize)) {
      // prettier-ignore
      throw new Error(
        `${BatchedAccumulator.name} expects a natural number for ` +
        `batch size, received ${this._batchSize}`,
      );
    }
  }

  /**
   * Returns the number of batches currently held by this instance.
   * Each batch contains exactly `batchSize` items, except for the
   * last batch, which may contain fewer items.
   *
   * @returns The number of batches held by this instance.
   */
  public get batchesCount(): number {
    return this._batches.length;
  }

  /**
   * Indicates whether this instance has accumulated any items.
   *
   * @returns `true` if no items have been accumulated, `false` otherwise.
   */
  public get isEmpty(): boolean {
    return this.batchesCount === 0;
  }

  /**
   * Returns the total number of accumulated items across all batches.
   * For example, if there are 5 full batches and the batch size is 100,
   * the output will be 500.
   *
   * ### Use Case: Conditional Extraction
   * This method is useful for determining whether a minimum threshold of
   * accumulated items has been reached before extracting batches, helping
   * to avoid excessively small bulk operations.
   *
   * @returns The total number of accumulated items across all batches.
   */
  public get accumulatedItemsCount(): number {
    const lastBatch = this._batches.at(-1);
    if (lastBatch === undefined) {
      return 0;
    }

    return lastBatch.length + (this.batchesCount - 1) * this._batchSize;
  }

  /**
   * Adds an item to the accumulator, grouping it into a batch of fixed size.
   * If the last batch is full or no batch exists, a new batch is created.
   *
   * @param item The item to accumulate.
   */
  public accumulateItem(item: ItemType): void {
    const lastBatch = this._batches.at(-1);

    if (lastBatch === undefined || lastBatch.length === this._batchSize) {
      // No batch exists yet in the current cycle (after the last extraction),
      // or the last batch is full. Create a new batch.
      const newBatch: ItemType[] = [item];
      this._batches.push(newBatch);
    } else {
      // Append the item to the existing last batch.
      lastBatch.push(item);
    }
  }

  /**
   * Extracts and returns the accumulated batches as a 2D array, where each batch
   * is a fixed-size array of `ItemType` items. The last batch may contain fewer
   * elements if the total count is not a multiple of the batch size.
   *
   * Calling this method **transfers ownership** of the extracted batches to the
   * caller, meaning the instance will **no longer retain them**. The accumulator
   * is reset, clearing its internal storage to begin a new accumulation cycle.
   *
   * @returns A 2D array containing the extracted batches, each represented as a
   *          fixed-size array of `ItemType` items.
   */
  public extractAccumulatedBatches(): ItemType[][] {
    const takenBatches = this._batches;
    this._batches = []; // Resets with a new reference.
    return takenBatches;
  }
}

function isNaturalNumber(num: number): boolean {
  if (typeof num !== 'number') {
    return false;
  }

  const floored = Math.floor(num);
  return floored >= 1 && floored === num;
}
