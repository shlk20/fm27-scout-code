# 名称表

FM 存档保存国家 / 赛事的数据库 ID，但不保存它们的显示名称；游戏从安装数据库渲染名称。
FM27 Scout 因此把名称表与存档解析分开。

## 国家 / 地区

内置 `shared/nation-names.csv`：

```csv
database_id,zh,en
135,克罗地亚,Croatia
```

解析时先读取 `game_db` 的 nation table，把存档内 `nation_id` 映射到 `database_id`，再用
CSV 取中文名（缺失时回退英文，再回退 `国家 #id`）。国籍筛选、球员表格和俱乐部信息都使用
这个名称。

名称表是事实性 ID → 国家名映射，不包含 SI/SEGA 的球员、俱乐部或赛事数据库内容。

## 赛事

内置 `shared/competition-names.csv`：

```csv
database_id,name
```

它默认只有表头。赛事名称属于游戏安装数据库内容，不随应用打包；在源码中按
`database_id` 填表后重新构建即可。赛事数据库 ID 与存档内 stage/competition ID 不同，应用会
在赛事索引接入后按 database_id 关联。

当前版本在停赛视图中展示赛事 ID；国家范围停赛会直接显示国家名称。
