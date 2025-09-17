class PcmProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    const channelData = input[0];
    // Forward to output to keep graph active
    if (output && output[0]) {
      output[0].set(channelData);
    }
    // Copy Float32Array to transfer to main thread
    const copy = new Float32Array(channelData.length);
    copy.set(channelData);
    this.port.postMessage(copy, [copy.buffer]);
    return true;
  }
}

registerProcessor("pcm-processor", PcmProcessor);
