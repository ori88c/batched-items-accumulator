"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const batched_items_accumulator_1 = require("./batched-items-accumulator");
function assertAccumulatorState(accumulator, batchSize, expectedNumberOfItems) {
    expect(accumulator.accumulatedItemsCount).toBe(expectedNumberOfItems);
    expect(accumulator.isEmpty).toBe(expectedNumberOfItems === 0);
    expect(accumulator.batchesCount).toBe(Math.ceil(expectedNumberOfItems / batchSize));
}
function runHappyPathTest(batchSize, numberOfItems, numberOfAccumulationCycles) {
    // Arrange: Initialize accumulator and assert initial state.
    const accumulator = new batched_items_accumulator_1.BatchedAccumulator(batchSize);
    assertAccumulatorState(accumulator, batchSize, 0);
    for (let cycle = 0; cycle < numberOfAccumulationCycles; ++cycle) {
        // Act: Accumulate items and assert intermediate state after each insertion.
        for (let item = 1; item <= numberOfItems; ++item) {
            accumulator.push(item);
            // 'item' also represents the number of accumulated items at this stage.
            assertAccumulatorState(accumulator, batchSize, item);
        }
        // Assert: Extract batches and validate item order within batches.
        const batches = accumulator.extractAccumulatedBatches();
        assertAccumulatorState(accumulator, batchSize, 0);
        let expectedItem = 1;
        for (const batch of batches) {
            for (const item of batch) {
                expect(item).toBe(expectedItem);
                ++expectedItem;
            }
        }
    }
}
describe('BatchedAccumulator tests', () => {
    describe('Happy path tests', () => {
        test('should accumulate items and reflect state when the last batch is not full', () => {
            const batchSize = 153;
            const numberOfItems = batchSize * 4 + 36;
            const numberOfAccumulationCycles = 3;
            runHappyPathTest(batchSize, numberOfItems, numberOfAccumulationCycles);
        });
        test('should accumulate items and reflect state when the last batch is full', () => {
            const batchSize = 84;
            const numberOfItems = batchSize * 6; // numberOfItems % batchSize === 0
            const numberOfAccumulationCycles = 4;
            runHappyPathTest(batchSize, numberOfItems, numberOfAccumulationCycles);
        });
    });
    describe('Negative path tests', () => {
        test('should throw an error when batch size is a non-natural number', () => {
            const invalidBatchSizes = [
                -4.3,
                -2,
                0,
                0.001,
                543.9938,
                'natural number',
                undefined,
                null,
                true,
            ];
            for (const batchSize of invalidBatchSizes) {
                expect(() => new batched_items_accumulator_1.BatchedAccumulator(batchSize)).toThrow();
            }
        });
        test('should return empty batches when no items are accumulated', () => {
            const batchSize = 5;
            const accumulator = new batched_items_accumulator_1.BatchedAccumulator(batchSize);
            const numberOfExtractionAttempts = 10;
            let previousExtraction;
            for (let attempt = 0; attempt < numberOfExtractionAttempts; ++attempt) {
                const batches = accumulator.extractAccumulatedBatches();
                // Reference inequality is expected, even when both are empty.
                // The internal reference should reset on each extraction, even
                // if no batches exist.
                expect(batches).not.toBe(previousExtraction);
                expect(batches.length).toBe(0);
                previousExtraction = batches;
            }
        });
    });
});
//# sourceMappingURL=batched-items-accumulator.test.js.map