---
id: oop
title: Object-Oriented Programming
part: 2
summary: Build classes with metatables — constructors, methods, `self`, inheritance, method overriding, composition and the conventions Roblox developers expect.
time: 45 min
level: Intermediate
objectives:
- Write a class with a constructor and methods using the standard Luau pattern
- Understand exactly how `self` and the colon operator work
- Separate per-object state from shared class data
- Build inheritance chains and call parent methods
- Choose composition over inheritance when it fits better
- Give classes a `Destroy` method for clean teardown
---

As games grow, you end up with many *things* that share behavior but have their own data: dozens of enemies, each with its own health; several weapons, each with its own ammo; one shop per player. **Object-oriented programming (OOP)** organizes code around these *objects* — bundles of data and the functions that operate on it.

Luau doesn't have a `class` keyword. Instead, it gives you tables and metatables, and the community has settled on one standard pattern that you'll see in virtually every Roblox codebase.

## The class pattern

```luau
local Enemy = {}
Enemy.__index = Enemy

-- Constructor: creates and returns a new object
function Enemy.new(name, health)
	local self = setmetatable({}, Enemy)
	self.name = name
	self.health = health
	return self
end

-- Methods: functions every Enemy object can use
function Enemy:takeDamage(amount)
	self.health = math.max(0, self.health - amount)
end

function Enemy:isAlive()
	return self.health > 0
end

-- Using the class
local zombie = Enemy.new("Zombie", 100)
local skeleton = Enemy.new("Skeleton", 60)

zombie:takeDamage(30)
print(zombie.health, skeleton.health)  --> 70 60
print(zombie:isAlive())                --> true
```

There are three moving parts:

1. **The class table** (`Enemy`) holds the methods. It's also used as the metatable for every object.
2. **`Enemy.__index = Enemy`** means "when an object is missing a key, look it up in `Enemy`". That's how every object finds its methods.
3. **The constructor** (`Enemy.new`) creates a fresh table for each object, attaches the metatable and fills in per-object data.

### How a method call resolves

When you write `zombie:takeDamage(30)`:

1. Luau looks for `takeDamage` in the `zombie` table. It isn't there — `zombie` only has `name` and `health`.
2. `zombie`'s metatable is `Enemy`, and `Enemy.__index` is `Enemy`, so Luau looks in `Enemy` and finds the function.
3. The colon passes `zombie` as the first argument, so it runs `Enemy.takeDamage(zombie, 30)`.

Methods live **once** in the class table, no matter how many objects exist. Each object stores only its own data.

## Understanding `self`

`function Enemy:takeDamage(amount)` is shorthand for:

```luau
function Enemy.takeDamage(self, amount)
	-- ...
end
```

The colon in a **definition** adds a hidden first parameter named `self`. The colon in a **call** passes the object as that first argument. Match them up and everything works.

:::warning The most common OOP bug
Calling a method with a dot instead of a colon — `zombie.takeDamage(30)` — passes `30` as `self` and `nil` as `amount`. You'll get an error like *attempt to perform arithmetic on nil* or *attempt to index number with 'health'*. If you see a strange error inside a method, check the call site for a `.` that should be a `:`.
:::

## Object data vs. class data

Anything you put on `self` in the constructor belongs to **one object**. Anything you put on the **class table** is **shared** by every object:

```luau
local Enemy = {}
Enemy.__index = Enemy
Enemy.MAX_HEALTH = 100      -- shared constant: fine

function Enemy.new(name)
	local self = setmetatable({}, Enemy)
	self.name = name
	self.health = Enemy.MAX_HEALTH
	self.loot = {}           -- per-object table: correct
	return self
end
```

:::danger Never put mutable tables on the class
If you write `Enemy.loot = {}` at the class level and then `table.insert(self.loot, item)` in a method, **every** enemy shares that one `loot` table. Reading `self.loot` finds nothing on the object, falls through `__index` to the class, and mutates the shared table. Always create per-object tables in the constructor.
:::

### Static functions

Some functions belong to the class but don't operate on a particular object — for example, constructors, or utility functions. Define them with a dot and call them with a dot:

```luau
function Enemy.fromConfig(config)
	return Enemy.new(config.name)
end
```

## Private fields

Luau has no `private` keyword. The convention is to prefix internal fields with an underscore — `self._lastAttack` — which tells other programmers "don't touch this from outside". If you need **real** privacy, closures (from @scope-closures) can hide data completely, at the cost of a little memory per object.

## Making objects print nicely

Since the class table is the metatable, you can add metamethods to it:

```luau
Enemy.__tostring = function(self)
	return `Enemy<{self.name}, {self.health} HP>`
end

print(Enemy.new("Ghost"))  --> Enemy<Ghost, 100 HP>
```

## Inheritance

**Inheritance** lets a class reuse and extend another class. A `Boss` *is an* `Enemy` with extra abilities. The trick is to give the subclass a metatable whose `__index` is the parent class — creating a lookup chain:

```luau
local Boss = setmetatable({}, { __index = Enemy })
Boss.__index = Boss

function Boss.new(name, phases)
	local self = Enemy.new(name)        -- build the base object first
	setmetatable(self, Boss)            -- then re-point it at Boss
	self.phases = phases
	self.phase = 1
	return self
end

-- Override a parent method
function Boss:takeDamage(amount)
	Enemy.takeDamage(self, amount * 0.5)   -- call the parent version
	if self.health < 50 and self.phase < self.phases then
		self.phase += 1
		print(`{self.name} enters phase {self.phase}!`)
	end
end

-- Add a brand-new method
function Boss:roar()
	print(`{self.name} roars!`)
end

local dragon = Boss.new("Dragon", 3)
dragon:takeDamage(120)  --> Dragon enters phase 2!
dragon:roar()           --> Dragon roars!
print(dragon:isAlive()) --> true   (inherited from Enemy)
```

Method lookup on `dragon` now goes: `dragon` → `Boss` → `Enemy`. The first place that has the key wins, which is exactly what makes **overriding** work.

To call the parent's version of an overridden method, call it explicitly through the parent class and pass `self`: `Enemy.takeDamage(self, amount)`.

:::tip Check what something is
To ask "is this object a Boss?", compare metatables: `getmetatable(obj) == Boss`. To ask "is it any kind of Enemy, including subclasses?", walk up the chain — a nice exercise in the challenges below.
:::

## Composition over inheritance

Inheritance is powerful, but deep hierarchies get rigid. What if you want a *flying* boss, a *flying* pet, and a *swimming* boss? Inheritance forces you into awkward trees.

**Composition** builds objects out of smaller, focused pieces instead:

```luau
local Health = {}
Health.__index = Health

function Health.new(max)
	return setmetatable({ max = max, current = max }, Health)
end

function Health:damage(amount)
	self.current = math.max(0, self.current - amount)
end

function Health:isDead()
	return self.current == 0
end

local Pet = {}
Pet.__index = Pet

function Pet.new(name)
	local self = setmetatable({}, Pet)
	self.name = name
	self.health = Health.new(50)   -- a Pet *has a* Health
	return self
end

local pet = Pet.new("Fluffy")
pet.health:damage(20)
print(pet.health.current)  --> 30
```

Now any class that needs health just *has* a `Health` component. A good rule: use inheritance for genuine "is a" relationships one or two levels deep; use composition for capabilities that many unrelated things share.

## Cleaning up: the Destroy convention

On Roblox, objects often own things that must be cleaned up: event connections, parts in the world, running threads. The convention is a `Destroy` method (capitalized, matching `Instance:Destroy()`):

```roblox
local Turret = {}
Turret.__index = Turret

function Turret.new(model)
	local self = setmetatable({}, Turret)
	self.model = model
	self._connections = {}

	table.insert(self._connections, model.Touched:Connect(function(hit)
		self:onTouched(hit)
	end))
	return self
end

function Turret:onTouched(hit)
	-- ...
end

function Turret:Destroy()
	for _, connection in self._connections do
		connection:Disconnect()
	end
	table.clear(self._connections)
	self.model:Destroy()
end
```

Forgetting to disconnect is one of the most common sources of memory leaks in Roblox games. You'll learn tidy patterns for this (Maids and Troves) in @patterns.

## Typed classes (a preview)

When you turn on type checking (@types), you'll want the type checker to understand your classes. The widely used pattern looks like this:

```luau
--!strict
local Enemy = {}
Enemy.__index = Enemy

type EnemyData = {
	name: string,
	health: number,
}

export type Enemy = typeof(setmetatable({} :: EnemyData, Enemy))

function Enemy.new(name: string, health: number): Enemy
	local self = setmetatable({} :: EnemyData, Enemy)
	self.name = name
	self.health = health
	return self
end

function Enemy.takeDamage(self: Enemy, amount: number)
	self.health = math.max(0, self.health - amount)
end

return Enemy
```

Don't worry about every symbol yet — @types explains `type`, `typeof` and `::` in detail.

:::quiz OOP
? What does `Enemy.__index = Enemy` accomplish?
+ Objects that lack a key look it up in the `Enemy` class table
- It makes `Enemy` read-only
- It registers the class globally
- It copies every method into each object
> Objects use `Enemy` as their metatable; `__index` makes missing keys (like method names) fall through to the class.

? `zombie.takeDamage(30)` (with a dot) is called on a method defined with a colon. What happens?
- It works the same as `zombie:takeDamage(30)`
+ `self` becomes `30` and `amount` becomes `nil`, causing an error
- Luau automatically fixes it
- It deals double damage
> The colon is what passes the object as `self`. With a dot, the arguments shift.

? Where should a per-object table like `self.inventory = {}` be created?
- At the top of the class file
+ Inside the constructor
- In `__index`
- In a global variable
> Tables created on the class are shared by all objects. Create per-object tables in the constructor.

? In `Boss`, how do you call `Enemy`'s version of an overridden `takeDamage`?
- `self:takeDamage(amount)`
- `super.takeDamage(amount)`
+ `Enemy.takeDamage(self, amount)`
- `Boss.takeDamage(Enemy, amount)`
> Call the parent class's function directly and pass `self` explicitly. `self:takeDamage` would call the Boss version again.

? Lookup on a `Boss` object goes in which order?
+ object → Boss → Enemy
- Enemy → Boss → object
- Boss → object → Enemy
- object → Enemy → Boss
> Each `__index` points one step up the chain; the first match wins.

? What's the main idea of composition?
- Making every class inherit from one base class
+ Building objects from smaller component objects they *have*, instead of inheriting
- Writing all methods with `.` instead of `:`
- Combining two metatables into one
> Composition ("has a") is more flexible than deep inheritance ("is a") trees.
:::

:::predict Where methods live
```luau
local Dog = {}
Dog.__index = Dog

function Dog.new(name)
	return setmetatable({ name = name }, Dog)
end

function Dog:speak()
	return self.name .. " says woof"
end

local d = Dog.new("Rex")
print(d:speak(), rawget(d, "speak"))
```
= Rex says woof nil
> The method is found through `__index`, but it doesn't live on the object itself — `rawget` bypasses the metatable and finds nothing.
:::

:::predict The shared-table trap
```luau
local Team = {}
Team.__index = Team
Team.members = {}

function Team.new(name)
	return setmetatable({ name = name }, Team)
end

function Team:add(player)
	table.insert(self.members, player)
end

local red, blue = Team.new("Red"), Team.new("Blue")
red:add("Koala")
print(#blue.members)
```
= 1
> Neither object has its own `members`, so both fall through to the single `Team.members` table. Adding to red's "members" adds to blue's too.
:::

:::predict Inheritance and overriding
```luau
local Animal = {}
Animal.__index = Animal
function Animal.new(name) return setmetatable({ name = name }, Animal) end
function Animal:describe() return self.name .. " says " .. self:sound() end
function Animal:sound() return "..." end

local Cat = setmetatable({}, { __index = Animal })
Cat.__index = Cat
function Cat.new(name) return setmetatable(Animal.new(name), Cat) end
function Cat:sound() return "meow" end

print(Cat.new("Tom"):describe())
```
= Tom says meow
> `describe` is inherited from `Animal`, but inside it `self:sound()` looks up `sound` on the actual object — a Cat — so the overridden version runs.
:::

## Challenges

:::challenge easy | Bank account
Write a `BankAccount` class with:

- `BankAccount.new(owner, startingBalance)` (balance defaults to 0)
- `:deposit(amount)` — rejects non-positive amounts by returning `false`
- `:withdraw(amount)` — returns `false` if the balance is too low, otherwise subtracts and returns `true`
- `:getBalance()`
- a `__tostring` like `"Koala's account: 150"`
@solution
```luau
local BankAccount = {}
BankAccount.__index = BankAccount

function BankAccount.new(owner, startingBalance)
	local self = setmetatable({}, BankAccount)
	self.owner = owner
	self._balance = startingBalance or 0
	return self
end

function BankAccount:deposit(amount)
	if amount <= 0 then
		return false
	end
	self._balance += amount
	return true
end

function BankAccount:withdraw(amount)
	if amount <= 0 or amount > self._balance then
		return false
	end
	self._balance -= amount
	return true
end

function BankAccount:getBalance()
	return self._balance
end

BankAccount.__tostring = function(self)
	return `{self.owner}'s account: {self._balance}`
end

local acc = BankAccount.new("Koala", 100)
acc:deposit(50)
print(acc:withdraw(500), acc)  --> false Koala's account: 150
```
:::

:::challenge medium | Queue class
Write a `Queue` class backed by a table with `head` and `tail` indices so that both `push` and `pop` are fast even with thousands of items (no `table.remove(t, 1)`). Methods: `push(value)`, `pop()` (returns `nil` when empty), `peek()`, `size()` and `isEmpty()`.
@hint
Store items in `self._items[index]`. `push` writes at `tail` and increments it; `pop` reads at `head`, sets that slot to `nil` and increments `head`.
@solution
```luau
local Queue = {}
Queue.__index = Queue

function Queue.new()
	return setmetatable({ _items = {}, _head = 1, _tail = 1 }, Queue)
end

function Queue:push(value)
	self._items[self._tail] = value
	self._tail += 1
end

function Queue:pop()
	if self:isEmpty() then
		return nil
	end
	local value = self._items[self._head]
	self._items[self._head] = nil
	self._head += 1
	return value
end

function Queue:peek()
	return self._items[self._head]
end

function Queue:size()
	return self._tail - self._head
end

function Queue:isEmpty()
	return self:size() == 0
end

local q = Queue.new()
q:push("Koala")
q:push("Builderman")
print(q:pop(), q:size()) --> Koala 1
```
:::

:::challenge medium | Shapes
Create a base `Shape` class with a `name` field, an `area()` method that returns `0`, and a `describe()` method returning `"<name> with area <area>"` (use `string.format("%.2f")`). Then create subclasses `Rectangle` (width, height), `Circle` (radius) and `Square` — which should inherit from **Rectangle**, not Shape. Each overrides `area()`. Put several shapes in an array and print `describe()` for each.
@hint
`Square.new(side)` can build itself using `Rectangle.new(side, side)` and then re-point the metatable at `Square`.
@solution
```luau
local Shape = {}
Shape.__index = Shape

function Shape.new(name)
	return setmetatable({ name = name }, Shape)
end

function Shape:area()
	return 0
end

function Shape:describe()
	return string.format("%s with area %.2f", self.name, self:area())
end

local Rectangle = setmetatable({}, { __index = Shape })
Rectangle.__index = Rectangle

function Rectangle.new(w, h)
	local self = setmetatable(Shape.new("Rectangle"), Rectangle)
	self.w, self.h = w, h
	return self
end

function Rectangle:area()
	return self.w * self.h
end

local Circle = setmetatable({}, { __index = Shape })
Circle.__index = Circle

function Circle.new(r)
	local self = setmetatable(Shape.new("Circle"), Circle)
	self.r = r
	return self
end

function Circle:area()
	return math.pi * self.r ^ 2
end

local Square = setmetatable({}, { __index = Rectangle })
Square.__index = Square

function Square.new(side)
	local self = setmetatable(Rectangle.new(side, side), Square)
	self.name = "Square"
	return self
end

for _, shape in { Rectangle.new(3, 4), Circle.new(1), Square.new(5) } do
	print(shape:describe())
end
--> Rectangle with area 12.00
--> Circle with area 3.14
--> Square with area 25.00
```
`Square` doesn't need its own `area` — it inherits `Rectangle:area()`.
:::

:::challenge hard | Arena battle
Build a tiny turn-based battle:

- `Fighter` base class: `name`, `health`, `attackPower`; methods `isAlive()`, `takeDamage(n)` and `attack(target)`, which deals `attackPower` damage and prints what happened.
- `Warrior` subclass: has a 25% chance to deal **double** damage on attack.
- `Mage` subclass: has `mana` (starts at 30). Attacking costs 10 mana and deals `attackPower * 2`; with insufficient mana it falls back to the normal `Fighter` attack.
- `isA(obj, class)` helper that returns `true` if `obj` is an instance of `class` **or any of its subclasses**.

Simulate a battle where a Warrior and a Mage take turns until one falls, then print the winner. Use `isA` to print each fighter's class at the start.
@hint
For `isA`, start at `getmetatable(obj)` and repeatedly move up using `getmetatable(current)` and its `__index`, comparing each step with `class`.
@hint
Override `attack` in each subclass and call `Fighter.attack(self, target)` (or a helper that takes a damage amount) for the shared logic.
@solution
```luau
local Fighter = {}
Fighter.__index = Fighter

function Fighter.new(name, health, attackPower)
	return setmetatable({ name = name, health = health, attackPower = attackPower }, Fighter)
end

function Fighter:isAlive()
	return self.health > 0
end

function Fighter:takeDamage(n)
	self.health = math.max(0, self.health - n)
end

function Fighter:strike(target, damage, verb)
	target:takeDamage(damage)
	print(`{self.name} {verb} {target.name} for {damage} ({target.health} HP left)`)
end

function Fighter:attack(target)
	self:strike(target, self.attackPower, "hits")
end

local Warrior = setmetatable({}, { __index = Fighter })
Warrior.__index = Warrior

function Warrior.new(name)
	return setmetatable(Fighter.new(name, 120, 12), Warrior)
end

function Warrior:attack(target)
	if math.random() < 0.25 then
		self:strike(target, self.attackPower * 2, "CRITS")
	else
		Fighter.attack(self, target)
	end
end

local Mage = setmetatable({}, { __index = Fighter })
Mage.__index = Mage

function Mage.new(name)
	local self = setmetatable(Fighter.new(name, 80, 9), Mage)
	self.mana = 30
	return self
end

function Mage:attack(target)
	if self.mana >= 10 then
		self.mana -= 10
		self:strike(target, self.attackPower * 2, "blasts")
	else
		Fighter.attack(self, target)
	end
end

local function isA(obj, class)
	local mt = getmetatable(obj)
	while mt do
		if mt == class then
			return true
		end
		local parentMeta = getmetatable(mt)
		mt = parentMeta and parentMeta.__index
	end
	return false
end

local a, b = Warrior.new("Rook"), Mage.new("Wisp")
print(a.name, isA(a, Warrior), isA(a, Fighter), isA(a, Mage)) --> Rook true true false

local attacker, defender = a, b
while a:isAlive() and b:isAlive() do
	attacker:attack(defender)
	attacker, defender = defender, attacker
end
print(`{if a:isAlive() then a.name else b.name} wins!`)
```
:::

:::recap
- The standard class: `local C = {}; C.__index = C`, a `C.new` constructor using `setmetatable({}, C)`, and methods defined with `function C:method()`.
- `obj:m(x)` passes `obj` as `self`. Calling with `.` by mistake is the #1 OOP bug.
- Per-object state goes on `self` in the constructor; never put mutable tables on the class.
- Inherit with `setmetatable(Sub, { __index = Base })` plus `Sub.__index = Sub`. Call parents with `Base.method(self, ...)`.
- Prefer composition for shared capabilities; keep inheritance shallow.
- Give Roblox classes a `Destroy` method that disconnects connections and destroys owned Instances.
:::
