import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IPA_SOUNDS,
  getIpaSoundById,
  getIpaSoundsByCategory,
} from "./ipa-data";

describe("IPA Data", () => {
  it("chứa đủ 44 âm IPA", () => {
    assert.equal(IPA_SOUNDS.length, 44);
  });

  it("phân loại đúng 12 nguyên âm đơn, 8 nguyên âm đôi, 24 phụ âm", () => {
    const monophthongs = getIpaSoundsByCategory("monophthong");
    const diphthongs = getIpaSoundsByCategory("diphthong");
    const consonants = getIpaSoundsByCategory("consonant");

    assert.equal(monophthongs.length, 12);
    assert.equal(diphthongs.length, 8);
    assert.equal(consonants.length, 24);
  });

  it("mỗi âm có đầy đủ thông tin bắt buộc", () => {
    for (const sound of IPA_SOUNDS) {
      assert.ok(sound.id);
      assert.ok(sound.symbol);
      assert.ok(sound.name);
      assert.ok(sound.vietnameseName);
      assert.ok(sound.phoneticProperties.summary);
      assert.ok(sound.articulation.steps.length > 0);
      assert.ok(sound.examples.length > 0);
      assert.ok(sound.spellingPatterns.length > 0);
    }
  });

  it("tìm đúng âm theo ID", () => {
    const sound = getIpaSoundById("i-long");
    assert.ok(sound);
    assert.equal(sound?.symbol, "/iː/");
  });
});
