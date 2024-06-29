import * as assert from "assert";
import { WebSocket } from 'mock-socket';

import RTC from '../src'

// const rtc = new RTC('wss://openroom-test.rokid.com/groupcall')

describe('rtc', () => {
    it('connect init websokcet response', (done) => {
        expect.assertions(1)
        // const rtc = new RTC('wss://openroom-test.rokid.com/groupcall')
        const ws = new WebSocket('wss://openroom-test.rokid.com/groupcall')
    });
    // describe('logger', () => {
    //     test('return log hello', () => {
    //         assert.strictEqual(rtc.logger('hello'), 'hello')
    //     })
    // })
    // describe('init', () => {
    //     test('return init obj', () => {
    //         assert.strictEqual(rtc.init('hello'), 'hello')
    //     })
    // })
})
