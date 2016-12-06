# leetcode-spider
用node.js爬我的leetcode解题源码

**Insipred by bony's python [leetcode downloader](https://github.com/bonfy/leetcode).**

##安装

```
npm install
npm link //目前还在改 准备做成NPM包 发到NPM去,所以先用NPM link将就一下啦
```

##使用

请事先建立好如下json文件(以命名为config.json为例):

```
{
	"username" : "hello@gmail.com",
	"password" : "xxxxxxxxx",
	"languages": ["java","c++","c"]
}
```

`username`和`password`对应你的的leetcode账户

`languages`对应于你用来解leetcode的编程语言.

###运行如下命令,便可爬取代码

```
lc-spider -c config.json

```



 