# leetcode-spider [![npm package](https://img.shields.io/npm/v/leetcode-spider.svg)](https://www.npmjs.com/package/leetcode-spider)

使用JS编写的的leetcode解题源码爬虫.爬取你自己的leetcode解题源码.


**Insipred by bony's python [leetcode downloader](https://github.com/bonfy/leetcode).**

如果你也想把你在[leetcode](https://leetcode.com/)上提交且Accepted的解题代码爬下来,那么本工具就是为此需求而生!爬下来的代码可以放在github上管理和开源出来,可以作为个人展示,更可以借助[leetcode-displayer](https://github.com/Ma63d/leetcode-displayer)将代码通过一个单页应用完美展现,几条命令就可以呈现一个leetcode源码博客,交流和展示搞起来!


**需要Node 4.0及以上版本!**

##安装 Installation

```
npm i leetcode-spider
```

##使用 Usage

请事先建立好如下json文件(以命名为config.json为例):


```
{
	"username" : "hello@gmail.com",
	"password" : "xxxxxxxxx",
	"language": ["java","c++","c"]
}
```

`username`和`password`对应你的的leetcode账户.


`language`对应于你用来解leetcode的编程语言,该项为一个数组,即使只有一种语言.

##运行 Execution

```
lc-spider // 默认使用config.json为配置文件运行爬虫
//或者lc-spider -c your_config.json
```
**程序会记录上一次爬取了哪些题目,之前爬取过的题目再次运行的时候不会爬取,除非你通过-n选项手动指定.**

所以,举个例子,按照我们的日常使用

* 当你昨天A了5道题,你用爬虫爬了下来
* 然后今天你A了6道题,你今天再次运行程序

程序此时会自动检查你相比上一次爬取结果多写了哪些题,然后把这些新增的代码爬取下来,不会重复的去爬取,你也不用手工指定你今天AC了哪些题.
永远只用一行命令:`lc-spider`.

**此外源码对应的leetcode的题目,也会爬取下来,放在代码目录,markdown格式**


##帮助 Help
```
lc-spider -h 
//lc-spider -help
```

##选项

###-config or -c
```
lc-spider -c xxx.json 
```

使用指定的配置文件运行lc-spider.默认使用的是config.json.

###-number or -n
```
lc-spider -n 2-15 3 78-101 
```

只爬取你指定的题目,可以使用连字符(如15-100),此处指定的是需要爬取的题号.程序会检查哪些题目你AC了,因此你可以放心的填写.比如你a了200-300之间的某几道题,但是不想一个个的指定出来,那你就大胆的写上200-300,程序会查找200-300范围内你AC的源码,并爬取下来.






 