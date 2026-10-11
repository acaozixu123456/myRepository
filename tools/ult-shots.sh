#!/bin/sh
# 用法: tools/ult-shots.sh <heroId> [敌方heroId] [步长] [张数]
H=$1; E=${2:-wei_xuhuchi,man_wutugu,wei_xiahoudun}; S=${3:-0.25}; N=${4:-16}
node tools/battle-shots.mjs "a=$H&b=$E&energy=100&seed=3&theme=${THEME:-meadow}" .shots/ult_$H $S $N ${START:-0}
